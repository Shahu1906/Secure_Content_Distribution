import crypto from "crypto";

export const generateJoinCode = () => {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
};
