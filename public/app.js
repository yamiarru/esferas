const state = {
  currentMonth: new Date(),
  selectedDate: null,
  bookingData: null,
  user: null,
};

const carouselTrack = document.getElementById('carouselTrack');
const slides = Array.from(carouselTrack.children);
let slideIndex = 0;

function updateCarousel() {
  carouselTrack.style.transform = `translateX(-${slideIndex * 100}%)`;
}

document.getElementById('nextSlide').addEventListener('click', () => {
  slideIndex = (slideIndex + 1) % slides.length;
  updateCarousel();
});

document.getElementById('prevSlide').addEventListener('click', () => {
  slideIndex = (slideIndex - 1 + slides.length) % slides.length;
  updateCarousel();
});

setInterval(() => {
  slideIndex = (slideIndex + 1) % slides.length;
  updateCarousel();
}, 6000);

const pillForm = document.getElementById('pillForm');
const pillGrid = document.getElementById('pillGrid');

function addPill({ image, title, description }) {
  const card = document.createElement('article');
  card.className = 'pill';
  card.innerHTML = `
    <img src="${image}" alt="${title}">
    <div class="pill-body">
      <h4>${title}</h4>
      <p>${description}</p>
    </div>
  `;
  pillGrid.prepend(card);
}

pillForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const image = document.getElementById('pillImage').value.trim();
  const title = document.getElementById('pillTitle').value.trim();
  const description = document.getElementById('pillDescription').value.trim();
  addPill({ image, title, description });
  pillForm.reset();
});

addPill({
  image: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=600&q=80',
  title: 'Box degustación',
  description: 'Una selección curada de nuestros productos más pedidos.'
});
addPill({
  image: 'https://images.unsplash.com/photo-1481391032119-d89fee407e44?auto=format&fit=crop&w=600&q=80',
  title: 'Café de especialidad',
  description: 'Granos recién tostados listos para tu método favorito.'
});

const calendarGrid = document.getElementById('calendarGrid');
const calendarTitle = document.getElementById('calendarTitle');

function renderCalendar() {
  const month = state.currentMonth.getMonth();
  const year = state.currentMonth.getFullYear();
  const firstDay = new Date(year, month, 1);
  const startDay = new Date(firstDay);
  startDay.setDate(firstDay.getDate() - firstDay.getDay());
  calendarTitle.textContent = state.currentMonth.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  calendarGrid.innerHTML = '';
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDay);
    date.setDate(startDay.getDate() + i);
    const day = document.createElement('button');
    day.className = 'day';
    day.textContent = date.getDate();
    if (date.getMonth() !== month) {
      day.classList.add('muted');
      day.disabled = true;
    } else {
      day.addEventListener('click', () => openBookingModal(date));
    }
    calendarGrid.appendChild(day);
  }
}

renderCalendar();

document.getElementById('nextMonth').addEventListener('click', () => {
  state.currentMonth.setMonth(state.currentMonth.getMonth() + 1);
  renderCalendar();
});

document.getElementById('prevMonth').addEventListener('click', () => {
  state.currentMonth.setMonth(state.currentMonth.getMonth() - 1);
  renderCalendar();
});

function openModal(id) {
  document.getElementById(id).setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  document.getElementById(id).setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('.close').forEach((btn) => {
  btn.addEventListener('click', (e) => closeModal(e.target.dataset.close));
});

function openBookingModal(date) {
  state.selectedDate = date;
  document.getElementById('selectedDateLabel').textContent = date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  openModal('bookingModal');
}

const loginButton = document.getElementById('loginButton');
const userBadge = document.getElementById('userBadge');

loginButton.addEventListener('click', () => {
  if (state.user) {
    fetch('/api/logout', { method: 'POST' }).then(() => {
      state.user = null;
      loginButton.textContent = 'Iniciar sesión';
      userBadge.textContent = '';
    });
  } else {
    openModal('loginModal');
  }
});

async function fetchSession() {
  const res = await fetch('/api/session');
  const data = await res.json();
  if (data.user) {
    state.user = data.user;
    loginButton.textContent = data.user.name;
    userBadge.textContent = `Hola, ${data.user.name}`;
  }
}

fetchSession();

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = Object.fromEntries(formData.entries());
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.user) {
    state.user = data.user;
    loginButton.textContent = data.user.name;
    userBadge.textContent = `Hola, ${data.user.name}`;
    closeModal('loginModal');
  }
});

const bookingForm = document.getElementById('bookingForm');

bookingForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  state.bookingData = Object.fromEntries(formData.entries());
  closeModal('bookingModal');
  openModal('paymentModal');
});

document.querySelectorAll('.payment-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!state.selectedDate || !state.bookingData) return;
    const payload = {
      ...state.bookingData,
      date: state.selectedDate,
      paymentOption: btn.dataset.option
    };
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      alert('Reserva confirmada y correo enviado. ¡Gracias!');
      closeModal('paymentModal');
      state.bookingData = null;
    } else {
      alert(data.error || 'No se pudo completar la reserva');
    }
  });
});

function scrollToTarget(target) {
  const el = document.querySelector(target);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
}

document.querySelectorAll('.nav-links .link').forEach((btn) => {
  const target = btn.dataset.target;
  if (target) {
    btn.addEventListener('click', () => scrollToTarget(target));
  }
});
