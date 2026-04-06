const slug = location.pathname.split('/gallery/')[1];
const isMobile = window.innerWidth <= 768;
let allPhotos = [];
let currentLbIndex = 0;

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Confetti ──────────────────────────────────────────────────
function spawnConfetti() {
  const c = document.getElementById('confetti');
  const colors = ['#f9ca24','#f0932b','#6ab04c','#e056fd','#22a6b3','#eb4d4b','#badc58','#f0c040'];
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    el.className = 'cp';
    el.style.cssText = `left:${Math.random()*100}%;background:${colors[i%colors.length]};
      animation-delay:${Math.random()*2}s;animation-duration:${2+Math.random()*2}s;
      width:${5+Math.random()*7}px;height:${5+Math.random()*7}px;
      border-radius:${Math.random()>.5?'50%':'2px'};opacity:0.9`;
    c.appendChild(el);
  }
}

// ── Load ──────────────────────────────────────────────────────
async function loadGallery() {
  const res = await fetch(`/api/gallery/${slug}`);
  document.getElementById('loading-screen').style.display = 'none';

  if (!res.ok) {
    const msg = '<div class="empty-state"><span>📭</span><p>Gallery not found.</p></div>';
    if (isMobile) document.getElementById('slides').innerHTML = msg;
    else document.getElementById('gallery-grid').innerHTML = msg;
    document.getElementById('mobile-view').style.display = isMobile ? 'block' : 'none';
    document.getElementById('desktop-view').style.display = isMobile ? 'none' : 'block';
    return;
  }

  const data = await res.json();
  allPhotos = data.photos;
  document.title = `${data.user.name} — Graduation`;

  // Show splash
  document.getElementById('grad-name').textContent = data.user.name;
  document.getElementById('hero-splash').style.display = 'flex';
  spawnConfetti();

  // Show correct view
  if (isMobile) {
    document.getElementById('mobile-view').style.display = 'block';
    document.getElementById('desktop-view').style.display = 'none';
    buildMobileView(data);
  } else {
    document.getElementById('mobile-view').style.display = 'none';
    document.getElementById('desktop-view').style.display = 'block';
    buildDesktopView(data);
  }
}

// ══════════════════════════════════════════════════════════════
// MOBILE VIEW
// ══════════════════════════════════════════════════════════════
function buildMobileView(data) {
  if (!data.photos.length) {
    document.getElementById('slides').innerHTML = '<div class="empty-state"><span>🖼️</span><p>No photos yet.</p></div>';
    document.getElementById('scroll-hint').style.display = 'none';
    return;
  }
  const container = document.getElementById('slides');
  data.photos.forEach((photo, i) => container.appendChild(buildSlide(photo, i)));
  if (data.photos.length < 2) document.getElementById('scroll-hint').style.display = 'none';
}

function buildSlide(photo, index) {
  const id = photo._id;
  const slide = document.createElement('div');
  slide.className = 'slide';
  slide.innerHTML = `
    <div class="slide-img">
      <img src="${photo.url}" alt="${escHtml(photo.caption||'photo')}" loading="${index<2?'eager':'lazy'}" />
      <div class="slide-counter">${index+1} / ${allPhotos.length}</div>
      ${photo.caption?`<div class="slide-caption">${escHtml(photo.caption)}</div>`:''}
    </div>
    <div class="slide-panel">
      <div class="panel-actions">
        <button class="m-like-btn" id="m-like-${id}" onclick="mToggleLike('${id}',this)" data-liked="false">
          <span class="heart">🤍</span>
        </button>
        <span class="m-like-count" id="m-lcount-${id}">${photo.likes} likes</span>
        <button class="m-comment-btn" onclick="mToggleComments('${id}')">
          💬 <span id="m-ccount-${id}">${photo.comments.length}</span>
        </button>
      </div>
      <div class="comments-drawer" id="m-drawer-${id}">
        <div class="m-comments-list" id="m-comments-${id}">
          ${photo.comments.map(c=>`<div class="m-comment-item"><strong>${escHtml(c.name)}</strong>${escHtml(c.message)}</div>`).join('')}
        </div>
        <div class="m-comment-form">
          <input type="text" id="m-cinput-${id}" placeholder="Name · Message" maxlength="100"
            onkeydown="if(event.key==='Enter')mPostComment('${id}')" />
          <button onclick="mPostComment('${id}')">Post</button>
        </div>
      </div>
    </div>`;
  return slide;
}

function mToggleComments(id) {
  const d = document.getElementById(`m-drawer-${id}`);
  d.classList.toggle('open');
  if (d.classList.contains('open')) {
    setTimeout(() => {
      const l = document.getElementById(`m-comments-${id}`);
      l.scrollTop = l.scrollHeight;
      document.getElementById(`m-cinput-${id}`).focus();
    }, 50);
  }
}

async function mToggleLike(id, btn) {
  const heart = btn.querySelector('.heart');
  const liked = btn.dataset.liked === 'true';
  btn.dataset.liked = String(!liked);
  heart.textContent = !liked ? '❤️' : '🤍';
  btn.classList.toggle('liked', !liked);
  const res = await fetch(`/api/photos/${id}/like`, { method: 'POST' });
  const data = await res.json();
  document.getElementById(`m-lcount-${id}`).textContent = `${data.likes} likes`;
}

async function mPostComment(id) {
  const input = document.getElementById(`m-cinput-${id}`);
  const val = input.value.trim();
  const dot = val.indexOf('·');
  let name, message;
  if (dot > 0) { name = val.slice(0,dot).trim(); message = val.slice(dot+1).trim(); }
  else { const sp = val.indexOf(' '); if (sp<1){input.style.borderColor='#e94560';setTimeout(()=>input.style.borderColor='',800);return;} name=val.slice(0,sp).trim(); message=val.slice(sp+1).trim(); }
  if (!name||!message){input.style.borderColor='#e94560';setTimeout(()=>input.style.borderColor='',800);return;}
  const res = await fetch(`/api/photos/${id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,message})});
  if (res.ok) {
    const c = await res.json();
    const list = document.getElementById(`m-comments-${id}`);
    const div = document.createElement('div');
    div.className = 'm-comment-item new';
    div.innerHTML = `<strong>${escHtml(c.name)}</strong>${escHtml(c.message)}`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    input.value = '';
    const cc = document.getElementById(`m-ccount-${id}`);
    cc.textContent = parseInt(cc.textContent||0)+1;
  }
}

// ══════════════════════════════════════════════════════════════
// DESKTOP VIEW
// ══════════════════════════════════════════════════════════════
function buildDesktopView(data) {
  document.getElementById('grad-name-desktop').textContent = data.user.name;

  if (!data.photos.length) {
    document.getElementById('gallery-grid').innerHTML = '<div class="empty-state"><span>🖼️</span><p>No photos yet.</p></div>';
    return;
  }

  const grid = document.getElementById('gallery-grid');
  data.photos.forEach((photo, i) => grid.appendChild(buildCard(photo, i)));

  requestAnimationFrame(() => {
    document.querySelectorAll('.photo-card').forEach((card, i) => {
      setTimeout(() => card.classList.add('visible'), i * 80);
    });
  });

  // Lightbox
  document.getElementById('lb-close').onclick = closeLb;
  document.getElementById('lb-prev').onclick = () => { currentLbIndex=(currentLbIndex-1+allPhotos.length)%allPhotos.length; document.getElementById('lightbox-img').src=allPhotos[currentLbIndex].url; };
  document.getElementById('lb-next').onclick = () => { currentLbIndex=(currentLbIndex+1)%allPhotos.length; document.getElementById('lightbox-img').src=allPhotos[currentLbIndex].url; };
  document.getElementById('lightbox').addEventListener('click', e => { if(e.target===e.currentTarget) closeLb(); });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('active')) return;
    if (e.key==='Escape') closeLb();
    if (e.key==='ArrowLeft') document.getElementById('lb-prev').click();
    if (e.key==='ArrowRight') document.getElementById('lb-next').click();
  });
}

function buildCard(photo, index) {
  const id = photo._id;
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${photo.url}" alt="${escHtml(photo.caption||'photo')}" loading="lazy" />
      <div class="img-overlay"><button class="view-btn" onclick="openLb(${index})">🔍 View</button></div>
    </div>
    ${photo.caption?`<p class="photo-caption">${escHtml(photo.caption)}</p>`:''}
    <div class="card-actions">
      <button class="d-like-btn" id="d-like-${id}" onclick="dToggleLike('${id}',this)" data-liked="false">
        <span class="heart">🤍</span>
        <span class="d-like-count" id="d-lcount-${id}">${photo.likes} likes</span>
      </button>
      <span class="d-comment-count">💬 <span id="d-ccount-${id}">${photo.comments.length}</span></span>
    </div>
    <div class="d-comments-section">
      <div class="d-comments-list" id="d-comments-${id}">
        ${photo.comments.map(c=>`<div class="d-comment-item"><strong>${escHtml(c.name)}</strong>${escHtml(c.message)}</div>`).join('')}
      </div>
      <div class="d-comment-form">
        <input type="text" id="d-cname-${id}" placeholder="Your name" maxlength="50" />
        <textarea id="d-cmsg-${id}" rows="2" placeholder="Leave a message..." maxlength="300"></textarea>
        <button class="d-post-btn" onclick="dPostComment('${id}')">Post ✉️</button>
      </div>
    </div>`;
  return card;
}

function openLb(index) {
  currentLbIndex = index;
  document.getElementById('lightbox-img').src = allPhotos[index].url;
  document.getElementById('lightbox').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLb() {
  document.getElementById('lightbox').classList.remove('active');
  document.body.style.overflow = '';
}

async function dToggleLike(id, btn) {
  const heart = btn.querySelector('.heart');
  const liked = btn.dataset.liked === 'true';
  btn.dataset.liked = String(!liked);
  heart.textContent = !liked ? '❤️' : '🤍';
  btn.classList.toggle('liked', !liked);
  btn.classList.add('pop');
  setTimeout(() => btn.classList.remove('pop'), 300);
  const res = await fetch(`/api/photos/${id}/like`, { method: 'POST' });
  const data = await res.json();
  document.getElementById(`d-lcount-${id}`).textContent = `${data.likes} likes`;
}

async function dPostComment(id) {
  const nameEl = document.getElementById(`d-cname-${id}`);
  const msgEl  = document.getElementById(`d-cmsg-${id}`);
  const name = nameEl.value.trim();
  const message = msgEl.value.trim();
  if (!name||!message) { msgEl.classList.add('shake'); setTimeout(()=>msgEl.classList.remove('shake'),400); return; }
  const res = await fetch(`/api/photos/${id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,message})});
  if (res.ok) {
    const c = await res.json();
    const list = document.getElementById(`d-comments-${id}`);
    const div = document.createElement('div');
    div.className = 'd-comment-item new';
    div.innerHTML = `<strong>${escHtml(c.name)}</strong>${escHtml(c.message)}`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    nameEl.value = ''; msgEl.value = '';
    const cc = document.getElementById(`d-ccount-${id}`);
    cc.textContent = parseInt(cc.textContent||0)+1;
  }
}

loadGallery();
