# P2PMessenger

WebRTC DataChannel based decentralized 1:1 messenger for React Native (iOS/Android) with an additional web client.

## Implemented MVP scope

- Onboarding with local profile creation (name + identity fingerprint)
- Peer list with connection status and unread counts
- QR signaling flow without central signaling server
- WebRTC DataChannel text messaging
- Message status: `sending`, `sent`, `delivered`, `read`, `failed`
- Local persistence via AsyncStorage (native) / localStorage (web)
- E2E layer v2 (`ECDH P-256 + HKDF-SHA256 + AES-256-GCM`)
- Replay protection (`seq` monotonic counter per peer session)
- Network status detection (native)
- Reconnect signal generation (ICE restart + exponential backoff)

## Native app (React Native)

1. Install dependencies:

```bash
npm install
```

2. iOS pods:

```bash
cd ios
pod install
cd ..
```

Native runtime additions:
- `react-native-quick-crypto`
- `react-native-keychain`
- `react-native-get-random-values`
- `buffer` polyfill in `index.js`

3. Run Metro:

```bash
npm start
```

4. Run app:

```bash
npm run android
npm run ios
```

## Web client (for quick testing)

1. Install web dependencies:

```bash
npm run web:install
```

2. Start web dev server:

```bash
npm run web:dev
```

3. Run web tests:

```bash
npm run web:test
```

4. Build web bundle:

```bash
npm run web:build
```

Notes:
- Web client currently supports signal copy/paste + QR display.
- Camera QR scanning for web is not wired yet.

## Protocol v2 (current)

- Signal payload no longer includes `sessionSecret`.
- Offer/Answer include ephemeral `keyAgreement.publicKeyB64` and nonces.
- Session key derivation:
  - `sharedSecret = ECDH(localPrivate, remotePublic)`
  - `sessionKey = HKDF-SHA256(sharedSecret, salt=offerNonce||answerNonce, info="p2pmsg-v2|...")`
- Envelope format:
  - `{v:2, senderId, sentAt, seq, ivB64, cipherTextB64, tagB64?}`
  - AAD: `senderId|sentAt|seq`
- Replay prevention:
  - receiver drops envelope when `seq <= lastSeq`.

Legacy notes:
- Protocol v1 (`sessionSecret`-based) is still accepted for temporary compatibility.
- Code contains warnings and TODO comments to remove v1 path after migration.

## TURN configuration

Default is STUN-only.

Native (React Native):
- Keep `DEFAULT_ICE_SERVERS` as-is.
- Provide TURN servers at runtime via either:
  - `global.__P2P_TURN_ICE_SERVERS__ = [{urls, username, credential}]`
  - or `P2P_TURN_ICE_SERVERS` env JSON (same shape).

Web (Vite):
- `VITE_TURN_URLS=turn:your.turn.server:3478,turns:your.turn.server:5349`
- `VITE_TURN_USERNAME=...`
- `VITE_TURN_CREDENTIAL=...`

## Identity seed migration (native)

- `identitySeed` is no longer persisted in AsyncStorage profile.
- On app startup, if legacy profile contains `identitySeed`:
  - move it to Keychain (`SecureStorageService`)
  - remove it from profile JSON and persist updated profile.

## Required native permissions

- iOS (`Info.plist`)
  - Camera usage (QR scan)
  - Microphone usage (voice call phase)
- Android (`AndroidManifest.xml`)
  - `CAMERA`
  - `INTERNET`
  - `ACCESS_NETWORK_STATE`

## Limitations

- TURN server provisioning UI is not included yet.
- Voice/video/file/group/push features are not included yet.
