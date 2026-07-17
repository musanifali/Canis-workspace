import { Module, type DynamicModule } from "@nestjs/common";
import { dbProviders } from "./db.provider.js";
import { TenantGuard } from "./auth/tenant.guard.js";
import { WorkspacesController } from "./workspaces/workspaces.controller.js";
import { WorkspacesService } from "./workspaces/workspaces.service.js";

@Module({})
export class AppModule {
  /**
   * Build the root module for a database url (tests point it at the test
   * database; main.ts at the configured one).
   * @returns The dynamic root module.
   */
  static forDatabase(databaseUrl: string): DynamicModule {
    return {
      module: AppModule,
      controllers: [WorkspacesController],
      providers: [...dbProviders(databaseUrl), TenantGuard, WorkspacesService],
    };
  }
}
