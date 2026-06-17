# 🎬 GorkhaReels - Short-Form Video Platform

A modern, high-performance short-form video platform for Gorkha creators and community, built with vanilla HTML/CSS/JavaScript, Appwrite backend, and Bunny CDN.

---

## 📋 Features

✅ **Infinite Scroll Feed** - TikTok-style vertical video feed  
✅ **Creator Profiles** - Profile management with stats and earnings  
✅ **Video Upload** - Drag-drop upload to Bunny CDN  
✅ **Monetization** - Track earnings from ads, tips, sponsorships  
✅ **Interactions** - Like, comment, share, and follow creators  
✅ **Trending** - Discover trending videos by algorithm  
✅ **Mobile-First** - Optimized for mobile and desktop  
✅ **Dark Theme** - Modern, eye-friendly dark UI  

---

## 🚀 Quick Start

### 1. **Download Files**
All files are in `/mnt/user-data/outputs/`:
- `index.html` - Feed page
- `upload.html` - Upload page
- `creator-dashboard.html` - Dashboard page
- `styles.css` - Stylesheet
- `appwrite-config.js` - Config & API clients
- `feed.js` - Feed logic
- `upload.js` - Upload logic
- `dashboard.js` - Dashboard logic

### 2. **Deploy to GitHub Pages**

```bash
# 1. Create a new repo: "gorkha-reels"
git clone https://github.com/YOUR_USERNAME/gorkha-reels.git
cd gorkha-reels

# 2. Copy all files into the directory
cp /mnt/user-data/outputs/* .

# 3. Push to GitHub
git add .
git commit -m "Initial GorkhaReels commit"
git push origin main

# 4. Enable GitHub Pages
# Go to Settings → Pages → Source: main branch → Save
# Your site will be at: https://YOUR_USERNAME.github.io/gorkha-reels/
```

### 3. **Configure Cloudflare (Optional)**

```
1. Add your domain to Cloudflare
2. Point DNS to GitHub Pages:
   - Type: CNAME
   - Name: gorkha-reels
   - Content: YOUR_USERNAME.github.io
3. Enable SSL/TLS in Cloudflare dashboard
```

---

## ⚙️ Configuration

All credentials are in `appwrite-config.js`:

```javascript
APPWRITE_CONFIG = {
  ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
  PROJECT_ID: 'gorkhareels',
  API_KEY: 'your_api_key_here',
  DATABASE_ID: 'gorka_db',
  COLLECTIONS: {
    CREATORS: 'creators',
    REELS: 'reels',
    COMMENTS: 'comments',
    LIKES: 'likes',
    EARNINGS: 'earnings',
    FOLLOWERS: 'followers',
    TRENDING: 'trending',
    REPORTS: 'reports'
  }
};

BUNNY_CONFIG = {
  API_KEY: 'your_bunny_key_here',
  STORAGE_ZONE: 'gorkhareel',
  PULL_ZONE_URL: 'https://gorkhareel-video.b-cdn.net/'
};
```

**⚠️ Security Note:** Keep API keys private! Never commit them to public repos.

---

## 📱 Page Structure

### **index.html** - Home Feed
- Infinite scroll video feed
- Auto-play videos
- Like, comment, share buttons
- Follow creators

### **upload.html** - Create Video
- Drag-drop video upload
- Video metadata form (title, description, tags)
- Category & language selection
- Direct upload to Bunny CDN

### **creator-dashboard.html** - Profile
- Creator stats (followers, views, videos)
- Earnings breakdown
- Video management
- Account settings

---

## 🗄️ Appwrite Collections Schema

### `creators`
```
userId (string, unique)
email (string, unique)
name (string)
bio (string)
profilePic (string)
followers (integer)
totalViews (integer)
totalEarnings (float)
isVerified (boolean)
bankAccountName, bankUpiId, bankAccountNumber, bankIfscCode (strings)
createdAt, updatedAt (datetime)
isActive (boolean)
totalReels (integer)
```

### `reels`
```
reelId (string, unique)
creatorId (string)
videoUrl (string)
thumbnail (string)
title (string)
description (string)
hashtags (string)
views (integer)
likes (integer)
comments (integer)
shares (integer)
duration (integer)
uploadedAt (datetime)
isMonetized (boolean)
category, language (string)
adRevenue (float)
```

### `comments`, `likes`, `earnings`, `followers`, `trending`, `reports`
See `APPWRITE_GORKHAREEL_SETUP.md` for full schema.

---

## 🌐 API Endpoints

All API calls use Appwrite REST API:

```
GET /databases/{database_id}/collections/{collection_id}/documents
POST /databases/{database_id}/collections/{collection_id}/documents
PATCH /databases/{database_id}/collections/{collection_id}/documents/{document_id}
DELETE /databases/{database_id}/collections/{collection_id}/documents/{document_id}
```

### Example: Get Reels
```javascript
const reels = await appwrite.getDocuments('reels', [
  'limit=10',
  'offset=0',
  'orderBy[]=uploadedAt'
]);
```

---

## 📤 Bunny CDN Video Upload

```javascript
// Upload video
const result = await bunny.uploadVideo(file, fileName);
// Returns: { success: true, url: 'https://gorkhareel-video.b-cdn.net/...' }

// Video URL is then stored in Appwrite
await appwrite.createDocument('reels', {
  videoUrl: result.url,
  ...otherMetadata
});
```

---

## 🔐 Authentication & Sessions

Uses localStorage for session management:

```javascript
// Login
session.setUser({ userId, name, email, profilePic });

// Check login
if (session.isLoggedIn()) { ... }

// Get current user
const user = session.getUser();

// Logout
session.logout();
```

---

## 📊 Analytics & Metrics

Track in real-time:
- **Views**: Incremented when video plays
- **Likes**: Stored in `likes` collection
- **Comments**: Stored in `comments` collection
- **Shares**: Tracked per reel
- **Earnings**: Stored in `earnings` collection

---

## 🎨 Customization

### Change Colors
Edit `styles.css` root variables:
```css
:root {
  --primary-red: #d32f2f;
  --dark-bg: #121212;
  --text-primary: #ffffff;
  /* ... */
}
```

### Modify Logo
Replace in `index.html`, `upload.html`, `creator-dashboard.html`:
```html
<div class="header-logo">GorkhaReels</div>
```

### Add Navigation
Edit bottom nav in HTML files:
```html
<button class="nav-item" data-nav="home">Home</button>
```

---

## 🐛 Troubleshooting

### Videos not loading?
- Check Bunny CDN pull zone URL in config
- Verify Appwrite database ID and collection IDs
- Check browser console for API errors

### Upload failing?
- File size > 500MB? Reduce it
- Invalid video format? Use MP4/WebM
- Check Bunny API key and storage zone

### Login not working?
- Check session storage in browser DevTools
- Verify Appwrite project ID and API key
- Clear localStorage and try again

---

## 📚 Resources

- **Appwrite Docs**: https://appwrite.io/docs
- **Bunny CDN Docs**: https://bunny.net/docs
- **GitHub Pages**: https://pages.github.com
- **Cloudflare**: https://www.cloudflare.com

---

## 📝 Future Features

- [ ] Live streaming
- [ ] DM & messaging
- [ ] Creator collaborations
- [ ] Advanced analytics
- [ ] Content moderation tools
- [ ] Mobile app (React Native)
- [ ] Blockchain tipping

---

## 💡 Tips for Success

1. **Optimize Videos**: Keep under 30-60 seconds
2. **Good Thumbnails**: Use eye-catching first frames
3. **Hashtag Strategy**: Use 3-5 relevant tags
4. **Engage Creators**: Reply to comments and DMs
5. **Monetize Early**: Focus on views first, then earnings

---

## 📞 Support

For issues or questions:
- Check documentation
- Review console errors
- Open GitHub issue
- Contact developer

---

## 📄 License

This project is open-source and available under MIT License.

---

## 🙌 Credits

Built with ❤️ for the Gorkha community.

**GorkhaReels** - Where Local Brands Go Global 🚀

---

**Last Updated**: June 2026  
**Version**: 1.0.0
