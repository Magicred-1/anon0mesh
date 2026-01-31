/**
 * Tor Service Tests
 *
 * Note: These tests require the Tor daemon to be running.
 * In CI environments, you may want to mock the native module.
 */

import { TorService, getTorService } from "../TorService";

// Mock react-native-nitro-tor
jest.mock("react-native-nitro-tor", () => ({
  RnTor: {
    startTorIfNotRunning: jest.fn().mockResolvedValue({
      is_success: true,
      onion_address: "test1234567890.onion",
      control: "control",
      error_message: "",
    }),
    initTorService: jest.fn().mockResolvedValue(true),
    getServiceStatus: jest.fn().mockResolvedValue(1), // RUNNING
    shutdownService: jest.fn().mockResolvedValue(true),
    httpGet: jest.fn().mockResolvedValue({
      status_code: 200,
      body: '{"jsonrpc":"2.0","result":123,"id":1}',
      error: "",
    }),
    httpPost: jest.fn().mockResolvedValue({
      status_code: 200,
      body: '{"jsonrpc":"2.0","result":"signature","id":1}',
      error: "",
    }),
    httpPut: jest.fn().mockResolvedValue({
      status_code: 200,
      body: "{}",
      error: "",
    }),
    httpDelete: jest.fn().mockResolvedValue({
      status_code: 200,
      body: "{}",
      error: "",
    }),
    createHiddenService: jest.fn().mockResolvedValue({
      is_success: true,
      onion_address: "service1234567890.onion",
      control: "control",
    }),
  },
}));

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
  documentDirectory: "file:///mock/documents/",
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
}));

describe("TorService", () => {
  let service: TorService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton
    (TorService as any).instance = undefined;
    service = getTorService();
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = getTorService();
      const instance2 = getTorService();
      expect(instance1).toBe(instance2);
    });
  });

  describe("Initialization", () => {
    it("should initialize with SOCKS only", async () => {
      const { RnTor } = jest.requireMock("react-native-nitro-tor");

      const result = await service.initSocksOnly();

      expect(result).toBe(true);
      expect(RnTor.initTorService).toHaveBeenCalledWith({
        socks_port: 9050,
        data_dir: "file:///mock/documents/tor_data",
        timeout_ms: 60000,
      });
      expect(service.initialized).toBe(true);
    });

    it("should initialize with hidden service", async () => {
      const result = await service.initialize();

      expect(result).toBe(true);
      expect(service.initialized).toBe(true);
      expect(service.currentOnionAddress).toBe("test1234567890.onion");
    });
  });

  describe("HTTP Requests", () => {
    beforeEach(async () => {
      await service.initSocksOnly();
    });

    it("should make HTTP GET request", async () => {
      const response = await service.httpGet({
        url: "https://api.devnet.solana.com",
      });

      expect(response.statusCode).toBe(200);
    });

    it("should make HTTP POST request", async () => {
      const response = await service.httpPost({
        url: "https://api.devnet.solana.com",
        body: JSON.stringify({ method: "getBalance" }),
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
