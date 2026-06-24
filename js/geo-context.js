/**
 * GEO CONTEXT MANAGER
 * Handles location initialization and context switching
 */

class GeoContextManager {
  constructor() {
    this.userLocation = null;
    this.currentContext = 'FOR_YOU';
    this.subscribers = [];
    this.initialized = false;
  }

  /**
   * Initialize user location (with permission)
   */
  async initialize() {
    if (this.initialized) return;
    
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not available');
        this.setDefaultLocation();
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          this.initialized = true;
          this.notifySubscribers('LOCATION_INITIALIZED');
          resolve(true);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          this.setDefaultLocation();
          resolve(false);
        }
      );
    });
  }

  /**
   * Set default location (Darjeeling)
   */
  setDefaultLocation() {
    this.userLocation = {
      latitude: 27.0410,
      longitude: 88.2663,
      accuracy: 50000
    };
    this.initialized = true;
    this.notifySubscribers('LOCATION_DEFAULT');
  }

  /**
   * Switch feed context
   */
  switchContext(newContext) {
    const valid = ['FOR_YOU', 'NEAR_YOU', 'SCENIC', 'TRENDING', 'FOLLOWING'];
    
    if (valid.includes(newContext)) {
      this.currentContext = newContext;
      this.notifySubscribers('CONTEXT_CHANGED', newContext);
    }
  }

  /**
   * Get distance between two coordinates (km)
   */
  haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  /**
   * Identify location zone from coordinates
   */
  getLocationZone(latitude, longitude) {
    const zones = [
      { name: 'Tiger Hill', lat: 27.0373, lng: 88.2590, radius: 0.5 },
      { name: 'Mall Road', lat: 27.0456, lng: 88.2659, radius: 0.3 },
      { name: 'Tea Gardens', lat: 27.0650, lng: 88.2850, radius: 2 },
      { name: 'Toy Train', lat: 27.0500, lng: 88.2700, radius: 1 },
      { name: 'Batasia Loop', lat: 27.0285, lng: 88.2630, radius: 0.5 }
    ];

    let closest = 'Darjeeling';
    let minDist = Infinity;

    zones.forEach(zone => {
      const dist = this.haversineDistance(latitude, longitude, zone.lat, zone.lng);
      if (dist < minDist && dist < zone.radius) {
        minDist = dist;
        closest = zone.name;
      }
    });

    return closest;
  }

  /**
   * Subscribe to context changes
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  notifySubscribers(event, data = null) {
    this.subscribers.forEach(cb => {
      try {
        cb({ event, data, context: this.currentContext, location: this.userLocation });
      } catch (e) {
        console.error('Subscriber error:', e);
      }
    });
  }

  /**
   * Get current state
   */
  getState() {
    return {
      context: this.currentContext,
      location: this.userLocation,
      initialized: this.initialized
    };
  }
}

// Export
window.GeoContextManager = GeoContextManager;
