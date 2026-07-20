import { Request, Response, NextFunction } from "express";
import { getConfig } from "../config";

export function validatePayloadSize(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);

  if (contentLength > config.MAX_PAYLOAD_BYTES) {
    res.status(413).json({
      error: "payload_too_large",
      message: `Payload exceeds ${config.MAX_PAYLOAD_BYTES} bytes`,
    });
    return;
  }

  next();
}
