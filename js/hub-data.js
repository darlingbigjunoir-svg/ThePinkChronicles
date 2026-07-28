/* ============================================================
   THE PINK CHRONICLES — hub-data.js
   Data functions shared across the hub pages. Include AFTER
   supabase-config.js and hub-auth.js.
   ============================================================ */
'use strict';

function hubEsc(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function hubTimeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ============================================================
   DISCUSSION FEED
   ============================================================ */
async function hubFetchPosts(limit) {
  let query = supabaseClient
    .from('posts')
    .select('*, post_likes(member_id), post_comments(id, member_id, author_name, content, created_at)')
    .order('created_at', { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data || [];
}

async function hubCreatePost(content, topic) {
  if (!HUB_MEMBER) return { error: 'Not logged in' };
  const { data, error } = await supabaseClient.from('posts').insert({
    member_id: HUB_MEMBER.id,
    author_name: hubMemberDisplayName(),
    content,
    topic: topic || null
  }).select().single();
  return { data, error };
}

async function hubDeletePost(postId) {
  const { error } = await supabaseClient.from('posts').delete().eq('id', postId);
  return { error };
}

async function hubToggleLike(postId, alreadyLiked) {
  if (!HUB_MEMBER) return { error: 'Not logged in' };
  if (alreadyLiked) {
    const { error } = await supabaseClient.from('post_likes')
      .delete().eq('post_id', postId).eq('member_id', HUB_MEMBER.id);
    return { error, liked: false };
  } else {
    const { error } = await supabaseClient.from('post_likes')
      .insert({ post_id: postId, member_id: HUB_MEMBER.id });
    return { error, liked: true };
  }
}

async function hubAddComment(postId, content) {
  if (!HUB_MEMBER) return { error: 'Not logged in' };
  const { data, error } = await supabaseClient.from('post_comments').insert({
    post_id: postId,
    member_id: HUB_MEMBER.id,
    author_name: hubMemberDisplayName(),
    content
  }).select().single();
  return { data, error };
}

/* ============================================================
   EVENTS
   ============================================================ */
async function hubFetchUpcomingEvents(limit) {
  const today = new Date().toISOString().split('T')[0];
  let query = supabaseClient
    .from('events')
    .select('*')
    .gte('event_date', today)
    .order('event_date', { ascending: true });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data || [];
}

/* ============================================================
   MEMBER DIRECTORY
   ============================================================ */
async function hubFetchDirectory() {
  const { data, error } = await supabaseClient
    .from('member_directory')
    .select('*')
    .order('joined_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data || [];
}

/* ============================================================
   SHARED TOP-BAR STATS — real points + real "days with us",
   used by every hub page so the numbers match everywhere
   ============================================================ */
async function hubRenderTopStats(member) {
  let dayNum = 1;
  if (member.joined_at) {
    const joined = new Date(member.joined_at);
    const diffDays = Math.floor((Date.now() - joined) / 86400000);
    dayNum = Math.max(1, diffDays + 1);
  }
  const streakNum = document.querySelector('.dash-stat-streak .dash-stat-num');
  if (streakNum) streakNum.innerHTML = `${dayNum} <i class="fa-solid fa-calendar-check"></i>`;
  const streakLabel = document.querySelector('.dash-stat-streak .dash-stat-label');
  if (streakLabel) streakLabel.textContent = dayNum === 1 ? 'Day 1 With Us' : 'Days With Us';

  const [{ count: myPostCount }, { count: myCommentCount }] = await Promise.all([
    supabaseClient.from('posts').select('id', { count: 'exact', head: true }).eq('member_id', member.id),
    supabaseClient.from('post_comments').select('id', { count: 'exact', head: true }).eq('member_id', member.id)
  ]);
  const points = (myPostCount || 0) * 10 + (myCommentCount || 0) * 3;
  const pointsNum = document.querySelector('.dash-stat-points .dash-stat-num');
  if (pointsNum) pointsNum.innerHTML = `${points} <i class="fa-solid fa-star"></i>`;
}
async function hubUpdateProfile(fields) {
  if (!HUB_MEMBER) return { error: 'Not logged in' };
  const { error } = await supabaseClient.from('members').update(fields).eq('id', HUB_MEMBER.id);
  if (!error) Object.assign(HUB_MEMBER, fields);
  return { error };
}

async function hubChangePassword(newPassword) {
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  return { error };
}