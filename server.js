const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'dueno@example.com';
const BASE_DIR = __dirname;
const STATIC_FILES = new Set(['index.html', 'style.css', 'app.js']);
const EMAIL_LOG = path.join(BASE_DIR, 'email-log.txt');

const sessionStore = new Map();
const bookingStore = [];

function logEmail(entry) {
  const line = `[${new Date().toISOString()}] TO:${entry.to} SUBJECT:${entry.subject}\n${entry.body}\n\n`;
  fs.appendFile(EMAIL_LOG, line, (err) => {
    if (err) {
      console.error('No se pudo registrar el correo simulado', err);
    }
  });
}

function createIcsEvent({ title, description, start, end, location }) {
  const uid = crypto.randomUUID();
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Esferas//ESF//ES',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    'T',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    'Z'
  ].join('');
}

function sendMail({ to, subject, body, ics }) {
  logEmail({ to, subject, body });
  if (ics) {
    fs.writeFile(path.join(BASE_DIR, `${subject.replace(/[^a-z0-9]/gi, '_')}.ics`), ics, (err) => {
      if (err) {
        console.error('No se pudo guardar el archivo ICS simulado', err);
      }
    });
  }
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.sessionId;
  if (sessionId && sessionStore.has(sessionId)) {
    return { id: sessionId, data: sessionStore.get(sessionId) };
  }
  return null;
}

function createSession(res, data) {
  const sessionId = crypto.randomBytes(16).toString('hex');
  sessionStore.set(sessionId, data);
  res.setHeader('Set-Cookie', `sessionId=${sessionId}; HttpOnly; Path=/; SameSite=Lax`);
  return sessionId;
}

function destroySession(res, sessionId) {
  sessionStore.delete(sessionId);
  res.setHeader('Set-Cookie', 'sessionId=; Max-Age=0; Path=/; SameSite=Lax');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (!STATIC_FILES.has(safePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/session') {
    const session = getSession(req);
    sendJson(res, 200, { user: session ? session.data : null });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    try {
      const body = await readJson(req);
      if (!body.name || !body.email) {
        sendJson(res, 400, { error: 'Nombre y email son obligatorios.' });
        return;
      }
      createSession(res, { name: body.name, email: body.email });
      sendJson(res, 200, { user: { name: body.name, email: body.email } });
    } catch (err) {
      console.error('Login error', err);
      sendJson(res, 500, { error: 'No se pudo iniciar sesión.' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/logout') {
    const session = getSession(req);
    if (session) {
      destroySession(res, session.id);
    } else {
      res.setHeader('Set-Cookie', 'sessionId=; Max-Age=0; Path=/; SameSite=Lax');
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/bookings') {
    try {
      const body = await readJson(req);
      const { date, name, email, phone, notes, paymentOption } = body;
      if (!date || !name || !email || !paymentOption) {
        sendJson(res, 400, { error: 'Completa los datos obligatorios.' });
        return;
      }
      const session = getSession(req);
      const customer = session ? session.data : { name, email };
      const bookingDate = new Date(date);
      const endDate = new Date(bookingDate.getTime() + 60 * 60 * 1000);
      const summary = `Reserva para ${bookingDate.toDateString()}\nNombre: ${name}\nEmail: ${email}\nTeléfono: ${phone || 'No informado'}\nNotas: ${notes || 'Sin notas'}\nPago: ${paymentOption}`;

      const ics = createIcsEvent({
        title: 'Reserva - Esferas',
        description: summary,
        start: bookingDate,
        end: endDate,
        location: 'Calle Wallaby'
      });

      bookingStore.push({
        id: crypto.randomUUID(),
        date: bookingDate.toISOString(),
        name,
        email,
        phone,
        notes,
        paymentOption
      });

      sendMail({
        to: email,
        subject: 'Confirmación de reserva',
        body: `${summary}\nSeleccionaste ${paymentOption === 'local' ? 'abonar en persona' : 'MercadoPago'}.`,
        ics
      });

      sendMail({
        to: OWNER_EMAIL,
        subject: 'Nueva reserva recibida',
        body: `Cliente: ${name}\nContacto: ${email}${phone ? ' / ' + phone : ''}\nFecha: ${bookingDate.toISOString()}\nMétodo: ${paymentOption}\nNotas: ${notes || 'Sin notas'}`,
        ics
      });

      sendJson(res, 200, { ok: true, customer, bookingDate });
    } catch (err) {
      console.error('Booking error', err);
      sendJson(res, 500, { error: 'No se pudo registrar la reserva.' });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res, pathname);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
});
