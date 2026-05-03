const demoFlag = process.env.EXPO_PUBLIC_DEMO_MODE?.toLowerCase();

export const DEMO_MODE = demoFlag === "1" || demoFlag === "true";

export const DEMO_RECIPIENT_ADDRESS =
  "9A8uBzYXR2Dy5mJqZ6wmKdP9rKfChS7mZXAZWV7kP8fH";
