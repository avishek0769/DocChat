import crypto from "node:crypto";

export function decryptApiKey(encryptedApiKey, iv, authTag) {
    const decipher = crypto.createDecipheriv(
        process.env.ENCRYPTION_ALGORITHM,
        Buffer.from(process.env.CIPHER_KEY, "base64"),
        Buffer.from(iv, "base64"),
    );

    decipher.setAuthTag(Buffer.from(authTag, "base64"));

    let decipherText = decipher.update(encryptedApiKey, "base64", "utf-8");
    decipherText += decipher.final("utf-8");

    return decipherText;
}
