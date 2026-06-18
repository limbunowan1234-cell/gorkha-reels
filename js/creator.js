// creator.js - Public creator profile
async function loadCreator() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return;
  
  try {
    const creator = await databases.getDocument('gorkha_db', 'creators', id);
    const reels = await databases.listDocuments('gorkha_db', 'reels', [
      Query.equal('creatorId', id)
    ]);
    
    const views = reels.documents.reduce((s, r) => s + (r.views || 0), 0);
    
    // Update page (match your HTML IDs)
    document.getElementById('videos-count').textContent = reels.total;
    document.getElementById('views-count').textContent = views;
    document.getElementById('followers-count').textContent = creator.followers || 0;
    document.getElementById('creator-name').textContent = creator.name;
    
  } catch (e) {
    console.error('Load failed:', e);
  }
}

document.addEventListener('DOMContentLoaded', loadCreator);