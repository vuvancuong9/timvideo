import { describe, expect, it } from "vitest";
import { extractDriveCreds } from "@/lib/drive";

const PEM =
  "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqh\\nABCDEF\\n-----END PRIVATE KEY-----\\n";

describe("extractDriveCreds", () => {
  it("dán riêng private key (có \\n literal)", () => {
    const { privateKey } = extractDriveCreds(PEM, "a@b.iam.gserviceaccount.com");
    expect(privateKey).toContain("-----BEGIN PRIVATE KEY-----");
    expect(privateKey).toContain("\n"); // đã chuyển \n -> xuống dòng thật
    expect(privateKey).not.toContain("\\n");
  });

  it("dán CẢ FILE JSON service account -> tự lấy private_key + client_email", () => {
    const json = JSON.stringify({
      type: "service_account",
      private_key: PEM,
      client_email: "svc@proj.iam.gserviceaccount.com",
      client_id: "123",
    });
    const { email, privateKey } = extractDriveCreds(json, undefined);
    expect(email).toBe("svc@proj.iam.gserviceaccount.com");
    expect(privateKey.startsWith("-----BEGIN PRIVATE KEY-----")).toBe(true);
    expect(privateKey.endsWith("-----END PRIVATE KEY-----")).toBe(true);
    expect(privateKey).not.toContain("client_email");
  });

  it("ô email đã có thì ưu tiên dùng nó, vẫn bóc được PEM từ JSON", () => {
    const json = JSON.stringify({ private_key: PEM, client_email: "x@y.com" });
    const { email, privateKey } = extractDriveCreds(json, "real@drive.com");
    expect(email).toBe("real@drive.com");
    expect(privateKey).toContain("BEGIN PRIVATE KEY");
  });
});
