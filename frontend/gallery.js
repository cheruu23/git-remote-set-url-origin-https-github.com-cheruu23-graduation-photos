const slug = location.pathname.split('/gallery/')[1];
const isMobile = window.innerWidth <= 768;
let allPhotos = [];
let currentLbIndex = 0;
let activeSheetPhotoId = null;
let lastTap = 0;

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Confetti ──────────────────────────────────────────────────
function spawnConfetti(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
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
    if (isMobile) document.getElementById('ig-feed').innerHTML = '<div class="ig-empty"><span>📭</span><p>Gallery not found.</p></div>';
    else document.getElementById('gallery-grid').innerHTML = '<div class="empty-state"><span>📭</span><p>Gallery not found.</p></div>';
    showViews();
    return;
  }

  const data = await res.json();
  allPhotos = data.photos;
  document.title = `${data.user.name} — Graduation`;

  document.getElementById('grad-name').textContent = data.user.name;
  document.getElementById('hero-splash').style.display = 'flex';
  spawnConfetti('confetti');

  showViews();

  if (isMobile) buildMobile(data);
  else buildDesktop(data);
}

function showViews() {
  document.getElementById('mobile-view').style.display  = isMobile ? 'block' : 'none';
  document.getElementById('desktop-view').style.display = isMobile ? 'none'  : 'block';
}

// ══════════════════════════════════════════════════════════════
//  MOBILE — Instagram style
// ══════════════════════════════════════════════════════════════
function buildMobile(data) {
  document.getElementById('ig-username').textContent = data.user.name;

  const feed = document.getElementById('ig-feed');
  if (!data.photos.length) {
    feed.innerHTML = '<div class="ig-empty"><span>🖼️</span><p>No photos yet.</p></div>';
    return;
  }

  data.photos.forEach((photo, i) => {
    feed.appendChild(buildPost(photo, i, data.user.name));
  });
}

function buildPost(photo, index, userName) {
  const id = photo._id;
  const post = document.createElement('div');
  post.className = 'ig-post';
  post.style.animationDelay = `${index * 0.06}s`;

  post.innerHTML = `
    <div class="ig-post-header">
      <div class="ig-avatar">🎓</div>
      <div>
        <div class="ig-post-name">${esc(userName)}</div>
        <div class="ig-post-num">Photo ${index + 1} of ${allPhotos.length}</div>
      </div>
    </div>

    <div class="ig-photo-wrap" id="wrap-${id}">
      <img src="${photo.url}" alt="${esc(photo.caption || 'photo')}" loading="${index < 2 ? 'eager' : 'lazy'}" />
      <div class="dt-heart" id="dt-${id}">❤️</div>
    </div>

    <div class="ig-actions">
      <button class="ig-btn" id="like-btn-${id}" onclick="igLike('${id}', this)" data-liked="false">
        <span class="heart">🤍</span>
      </button>
      <button class="ig-btn" onclick="openSheet('${id}')">💬</button>
      <div class="ig-spacer"></div>
    </div>

    <div class="ig-likes" id="likes-${id}">${photo.likes} likes</div>

    ${photo.caption ? `<div class="ig-caption"><strong>${esc(userName)}</strong>${esc(photo.caption)}</div>` : ''}

    <div class="ig-view-comments" onclick="openSheet('${id}')">
      ${photo.comments.length > 0
        ? `View all ${photo.comments.length} comment${photo.comments.length > 1 ? 's' : ''}`
        : 'Add a comment...'}
    </div>
  `;

  // Double-tap to like
  const wrap = post.querySelector('.ig-photo-wrap');
  wrap.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      const btn = post.querySelector(`#like-btn-${id}`);
      if (btn.dataset.liked !== 'true') igLike(id, btn);
      showDtHeart(id);
    }
    lastTap = now;
  });

  return post;
}

function showDtHeart(id) {
  const el = document.getElementById(`dt-${id}`);
  el.classList.remove('hide');
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); el.classList.add('hide'); }, 800);
  setTimeout(() => el.classList.remove('hide'), 1100);
}

async function igLike(id, btn) {
  const heart = btn.querySelector('.heart');
  const liked = btn.dataset.liked === 'true';
  btn.dataset.liked = String(!liked);
  heart.textContent = !liked ? '❤️' : '🤍';
  btn.classList.toggle('liked', !liked);
  const res = await fetch(`/api/photos/${id}/like`, { method: 'POST' });
  const data = await res.json();
  document.getElementById(`likes-${id}`).textContent = `${data.likes} likes`;
}

// ── Comment Sheet ─────────────────────────────────────────────
function openSheet(photoId) {
  activeSheetPhotoId = photoId;
  const photo = allPhotos.find(p => p._id === photoId);
  const list = document.getElementById('sheet-comments');
  list.innerHTML = '';

  if (photo && photo.comments.length) {
    photo.comments.forEach(c => list.appendChild(buildSheetComment(c)));
  } else {
    list.innerHTML = '<p style="color:#666;font-size:0.85rem;text-align:center;padding:1rem">No comments yet. Be first!</p>';
  }

  document.getElementById('sheet-name').value = '';
  document.getElementById('sheet-msg').value = '';
  document.getElementById('comment-sheet').classList.add('open');
  document.getElementById('sheet-overlay').classList.add('open');
  setTimeout(() => {
    list.scrollTop = list.scrollHeight;
    document.getElementById('sheet-msg').focus();
  }, 350);
}

function closeSheet() {
  document.getElementById('comment-sheet').classList.remove('open');
  document.getElementById('sheet-overlay').classList.remove('open');
  activeSheetPhotoId = null;
}

function buildSheetComment(c) {
  const div = document.createElement('div');
  div.className = 'sc-item';
  div.innerHTML = `
    <div class="sc-avatar">${esc(c.name[0].toUpperCase())}</div>
    <div class="sc-body">
      <div class="sc-name">${esc(c.name)}</div>
      <div class="sc-msg">${esc(c.message)}</div>
    </div>`;
  return div;
}

async function postSheetComment() {
  if (!activeSheetPhotoId) return;
  const name = document.getElementById('sheet-name').value.trim();
  const message = document.getElementById('sheet-msg').value.trim();
  if (!name || !message) {
    const el = !name ? document.getElementById('sheet-name') : document.getElementById('sheet-msg');
    el.style.borderColor = '#e94560';
    setTimeout(() => el.style.borderColor = '', 800);
    return;
  }

  const res = await fetch(`/api/photos/${activeSheetPhotoId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message })
  });

  if (res.ok) {
    const c = await res.json();
    const list = document.getElementById('sheet-comments');
    // Remove "no comments" placeholder
    if (list.querySelector('p')) list.innerHTML = '';
    const div = buildSheetComment(c);
    div.classList.add('new');
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    document.getElementById('sheet-name').value = '';
    document.getElementById('sheet-msg').value = '';

    // Update comment count in feed
    const photo = allPhotos.find(p => p._id === activeSheetPhotoId);
    if (photo) {
      photo.comments.push(c);
      const viewEl = document.querySelector(`#wrap-${activeSheetPhotoId}`)
        ?.closest('.ig-post')?.querySelector('.ig-view-comments');
      if (viewEl) {
        const count = photo.comments.length;
        viewEl.textContent = `View all ${count} comment${count > 1 ? 's' : ''}`;
      }
    }
  }
}

// Enter key to post
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('sheet-msg')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') postSheetComment();
  });
});

// ══════════════════════════════════════════════════════════════
//  DESKTOP — masonry grid
// ══════════════════════════════════════════════════════════════
function buildDesktop(data) {
  document.getElementById('grad-name-desktop').textContent = data.user.name;
  spawnConfetti('confetti-d');

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

  document.getElementById('lb-close').onclick = closeLb;
  document.getElementById('lb-prev').onclick = () => { currentLbIndex = (currentLbIndex - 1 + allPhotos.length) % allPhotos.length; document.getElementById('lightbox-img').src = allPhotos[currentLbIndex].url; };
  document.getElementById('lb-next').onclick = () => { currentLbIndex = (currentLbIndex + 1) % allPhotos.length; document.getElementById('lightbox-img').src = allPhotos[currentLbIndex].url; };
  document.getElementById('lightbox').addEventListener('click', e => { if (e.target === e.currentTarget) closeLb(); });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('active')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') document.getElementById('lb-prev').click();
    if (e.key === 'ArrowRight') document.getElementById('lb-next').click();
  });
}

function buildCard(photo, index) {
  const id = photo._id;
  const card = document.createElement('div');
  card.className = 'photo-card';
  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${photo.url}" alt="${esc(photo.caption || 'photo')}" loading="lazy" />
      <div class="img-overlay"><button class="view-btn" onclick="openLb(${index})">🔍 View</button></div>
    </div>
    ${photo.caption ? `<p class="photo-caption">${esc(photo.caption)}</p>` : ''}
    <div class="card-actions">
      <button class="d-like-btn" id="d-like-${id}" onclick="dLike('${id}',this)" data-liked="false">
        <span class="heart">🤍</span>
        <span class="d-like-count" id="d-lcount-${id}">${photo.likes} likes</span>
      </button>
      <span class="d-comment-count">💬 <span id="d-ccount-${id}">${photo.comments.length}</span></span>
    </div>
    <div class="d-comments-section">
      <div class="d-comments-list" id="d-comments-${id}">
        ${photo.comments.map(c => `<div class="d-comment-item"><strong>${esc(c.name)}</strong>${esc(c.message)}</div>`).join('')}
      </div>
      <div class="d-comment-form">
        <input type="text" id="d-cname-${id}" placeholder="Your name" maxlength="50" />
        <textarea id="d-cmsg-${id}" rows="2" placeholder="Leave a message..." maxlength="300"></textarea>
        <button class="d-post-btn" onclick="dPost('${id}')">Post ✉️</button>
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

async function dLike(id, btn) {
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

async function dPost(id) {
  const nameEl = document.getElementById(`d-cname-${id}`);
  const msgEl  = document.getElementById(`d-cmsg-${id}`);
  const name = nameEl.value.trim(), message = msgEl.value.trim();
  if (!name || !message) { msgEl.classList.add('shake'); setTimeout(() => msgEl.classList.remove('shake'), 400); return; }
  const res = await fetch(`/api/photos/${id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message }) });
  if (res.ok) {
    const c = await res.json();
    const list = document.getElementById(`d-comments-${id}`);
    const div = document.createElement('div');
    div.className = 'd-comment-item new';
    div.innerHTML = `<strong>${esc(c.name)}</strong>${esc(c.message)}`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    nameEl.value = ''; msgEl.value = '';
    const cc = document.getElementById(`d-ccount-${id}`);
    cc.textContent = parseInt(cc.textContent || 0) + 1;
  }
}

loadGallery();
