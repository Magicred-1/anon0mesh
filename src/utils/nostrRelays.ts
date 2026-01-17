/**
 * Nostr Relay Database - Parsed from CSV
 * Geographic coordinates for proximity-based relay selection
 */

import { NostrRelay } from './relaySelector';

export const NOSTR_RELAYS: NostrRelay[] = [
    // Popular open relays (known to be reliable)
    { url: 'wss://relay.primal.net', latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    { url: 'wss://relay.nostr.bg', latitude: 42.6977, longitude: 23.3219 }, // Sofia, Bulgaria
    { url: 'wss://nostr.mom', latitude: 40.7128, longitude: -74.006 }, // New York
    { url: 'wss://nostr-pub.wellorder.net', latitude: 43.6532, longitude: -79.3832 }, // Toronto
    { url: 'wss://relay.current.fyi', latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    { url: 'wss://nostr.fmt.wiz.biz', latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    { url: 'wss://relay.nostr.info', latitude: 52.52, longitude: 13.405 }, // Berlin
    { url: 'wss://nostr-relay.wlvs.space', latitude: 51.5074, longitude: -0.1278 }, // London
    { url: 'wss://nostr.zebedee.cloud', latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    { url: 'wss://relay.orangepill.dev', latitude: 40.7128, longitude: -74.006 }, // New York
    
    // European relays
    { url: 'wss://relay.nostrich.de', latitude: 52.52, longitude: 13.405 }, // Berlin
    { url: 'wss://nostr.wine', latitude: 48.8566, longitude: 2.3522 }, // Paris
    { url: 'wss://relay.nostr.ch', latitude: 47.3769, longitude: 8.54169 }, // Zurich
    { url: 'wss://relay.minds.com/nostr/v1/ws', latitude: 40.7128, longitude: -74.006 }, // New York
    { url: 'wss://nos.lol', latitude: 51.5074, longitude: -0.1278 }, // London
    { url: 'wss://relay.snort.social', latitude: 43.6532, longitude: -79.3832 }, // Toronto
    { url: 'wss://nostr.oxtr.dev', latitude: 50.4754, longitude: 12.3683 }, // Germany
    { url: 'wss://relay.nostr.band', latitude: 52.52, longitude: 13.405 }, // Berlin
    
    // US relays
    { url: 'wss://relay.damus.io', latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    { url: 'wss://nostr.bitcoiner.social', latitude: 40.7128, longitude: -74.006 }, // New York
    { url: 'wss://relay.nostrati.com', latitude: 33.7490, longitude: -84.3880 }, // Atlanta
    { url: 'wss://nostr.rocks', latitude: 37.7749, longitude: -122.4194 }, // San Francisco
    { url: 'wss://nostr-relay.freeberty.net', latitude: 40.7128, longitude: -74.006 }, // New York
    
    // Asia-Pacific relays
    { url: 'wss://relay.nostr.wirednet.jp', latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    { url: 'wss://nostr.fediverse.jp', latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    { url: 'wss://nostr-relay.nokotaro.com', latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    { url: 'wss://nostr.h3z.jp', latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    { url: 'wss://relay.nostr.or.jp', latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    { url: 'wss://nostr.holybea.com', latitude: 37.5665, longitude: 126.9780 }, // Seoul
    { url: 'wss://nostr.satstralia.com', latitude: -33.8688, longitude: 151.209 }, // Sydney
    
    // Development/Testing relays
    { url: 'wss://nostr-dev.wellorder.net', latitude: 43.6532, longitude: -79.3832 }, // Toronto
    { url: 'wss://nostr.onsats.org', latitude: 40.7128, longitude: -74.006 }, // New York
    { url: 'wss://relay.nostrid.com', latitude: 52.52, longitude: 13.405 }, // Berlin
    { url: 'wss://nostr.inosta.cc', latitude: 35.6762, longitude: 139.6503 }, // Tokyo
    
    // Geographic diversity
    { url: 'wss://relay.nostr.net', latitude: 40.7128, longitude: -74.006 }, // New York
    { url: 'wss://nostr21.com', latitude: 48.8566, longitude: 2.3522 }, // Paris
    { url: 'wss://nostr.cercatrova.me', latitude: 41.9028, longitude: 12.4964 }, // Rome
    { url: 'wss://relay.lexingtonbitcoin.org', latitude: 38.0406, longitude: -84.5037 }, // Lexington, KY
    { url: 'wss://relay.nostr.bg', latitude: 42.6977, longitude: 23.3219 }, // Sofia
];
