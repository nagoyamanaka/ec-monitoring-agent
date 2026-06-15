import express, { Application, Router } from "express";
import http from "http";
import { errorHandler } from "./middleware/errorHandler.js";

export class Server {
  readonly express: Application;
  readonly router: Router;
  private httpServer?: http.Server;

  constructor(private readonly port: number) {
    this.express = express();
    this.router = Router();
    this.express.use(express.json());
    this.express.use(this.router);
    this.express.use(errorHandler);
  }

  listen(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = this.express.listen(this.port, () => {
        console.log(JSON.stringify({
          severity: "INFO",
          service: "ec-backend",
          message: `EC backend listening on port ${this.port}`,
          timestamp: new Date().toISOString(),
        }));
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.httpServer) {
        this.httpServer.close((err) => (err ? reject(err) : resolve()));
      } else {
        resolve();
      }
    });
  }
}
