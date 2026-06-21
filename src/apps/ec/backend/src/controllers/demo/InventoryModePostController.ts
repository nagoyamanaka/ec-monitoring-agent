import { Request, Response } from "express";
import {
  DemoInventoryRepository,
  InventoryMode,
} from "../../../../../../Contexts/EC/Inventory/infrastructure/DemoInventoryRepository.js";

export class InventoryModePostController {
  constructor(private readonly demoInventoryRepository: DemoInventoryRepository) {}

  run(req: Request, res: Response): void {
    const { mode } = req.body as { mode: InventoryMode };
    this.demoInventoryRepository.setMode(mode);
    res.json({ mode });
  }
}
