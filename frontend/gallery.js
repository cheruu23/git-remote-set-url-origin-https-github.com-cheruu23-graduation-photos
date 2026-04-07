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
//  DESKTOP — single photo viewer
// ══════════════════════════════════════════════════════════════
let dIndex = 0;

function buildDesktop(data) {
  document.getElementById('grad-name-desktop').textContent = data.user.name;
  spawnConfetti('confetti-d');

  if (!data.photos.length) {
    document.getElementById('d-prev').style.display = 'none';
    document.getElementById('d-next').style.display = 'none';
    document.querySelector('.d-side-panel').innerHTML = '<div class="empty-state"><span>🖼️</span><p>No photos yet.</p></div>';
    return;
  }

  // Build dots
  const dotsEl = document.getElementById('d-dots');
  allPhotos.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.className = 'd-dot' + (i === 0 ? ' active' : '');
    dot.onclick = () => dGoTo(i);
    dotsEl.appendChild(dot);
  });

  // Nav
  document.getElementById('d-prev').onclick = () => dGoTo(dIndex - 1);
  document.getElementById('d-next').onclick = () => dGoTo(dIndex + 1);

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') dGoTo(dIndex - 1);
    if (e.key === 'ArrowRight') dGoTo(dIndex + 1);
  });

  dGoTo(0);
}

function dGoTo(i) {
  if (i < 0 || i >= allPhotos.length) return;
  dIndex = i;
  const photo = allPhotos[i];
  const id = photo._id;

  // Photo
  const img = document.getElementById('d-photo');
  img.style.animation = 'none';
  img.offsetHeight; // reflow
  img.style.animation = '';
  img.src = photo.url;
  img.alt = photo.caption || 'photo';

  // Header
  document.getElementById('d-side-name').textContent = document.getElementById('grad-name-desktop').textContent;
  document.getElementById('d-side-counter').textContent = `Photo ${i + 1} of ${allPhotos.length}`;

  // Caption
  const capEl = document.getElementById('d-caption');
  capEl.textContent = photo.caption || '';

  // Likes
  const likeBtn = document.getElementById('d-like-btn');
  likeBtn.dataset.id = id;
  likeBtn.dataset.liked = 'false';
  document.getElementById('d-heart').textContent = '🤍';
  likeBtn.classList.remove('liked');
  document.getElementById('d-like-count').textContent = `${photo.likes} likes`;

  // Comments
  const list = document.getElementById('d-comments-list');
  list.innerHTML = '';
  if (!photo.comments.length) {
    list.innerHTML = '<p style="color:#444;font-size:0.82rem;text-align:center;padding:1rem">No comments yet.</p>';
  } else {
    photo.comments.forEach(c => list.appendChild(dBuildComment(c)));
    list.scrollTop = list.scrollHeight;
  }

  // Clear form
  document.getElementById('d-cname').value = '';
  document.getElementById('d-cmsg').value = '';

  // Dots
  document.querySelectorAll('.d-dot').forEach((d, idx) => d.classList.toggle('active', idx === i));

  // Nav state
  document.getElementById('d-prev').disabled = i === 0;
  document.getElementById('d-next').disabled = i === allPhotos.length - 1;
}

function dBuildComment(c) {
  const div = document.createElement('div');
  div.className = 'd-comment-item';
  div.innerHTML = `
    <div class="d-c-avatar">${esc(c.name[0].toUpperCase())}</div>
    <div class="d-c-body">
      <div class="d-c-name">${esc(c.name)}</div>
      <div class="d-c-msg">${esc(c.message)}</div>
    </div>`;
  return div;
}

async function dLike() {
  const btn = document.getElementById('d-like-btn');
  const id = btn.dataset.id;
  const liked = btn.dataset.liked === 'true';
  btn.dataset.liked = String(!liked);
  document.getElementById('d-heart').textContent = !liked ? '❤️' : '🤍';
  btn.classList.toggle('liked', !liked);
  const res = await fetch(`/api/photos/${id}/like`, { method: 'POST' });
  const data = await res.json();
  document.getElementById('d-like-count').textContent = `${data.likes} likes`;
  // Update in allPhotos
  const photo = allPhotos.find(p => p._id === id);
  if (photo) photo.likes = data.likes;
}

async function dPost() {
  const btn = document.getElementById('d-like-btn');
  const id = btn.dataset.id;
  const name = document.getElementById('d-cname').value.trim();
  const message = document.getElementById('d-cmsg').value.trim();
  const msgEl = document.getElementById('d-cmsg');
  if (!name || !message) {
    msgEl.style.borderColor = '#e94560';
    setTimeout(() => msgEl.style.borderColor = '', 800);
    return;
  }
  const res = await fetch(`/api/photos/${id}/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, message })
  });
  if (res.ok) {
    const c = await res.json();
    const list = document.getElementById('d-comments-list');
    if (list.querySelector('p')) list.innerHTML = '';
    const div = dBuildComment(c);
    div.classList.add('new');
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
    document.getElementById('d-cname').value = '';
    document.getElementById('d-cmsg').value = '';
    const photo = allPhotos.find(p => p._id === id);
    if (photo) photo.comments.push(c);
  }
}

loadGallery();
