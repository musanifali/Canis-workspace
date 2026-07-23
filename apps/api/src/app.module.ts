import { Module, type DynamicModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { dbProviders } from "./db.provider.js";
import { AuditController } from "./audit/audit.controller.js";
import { AuthController } from "./auth/auth.controller.js";
import { TenantGuard } from "./auth/tenant.guard.js";
import { ContractsController } from "./contracts/contracts.controller.js";
import { AllExceptionsFilter } from "./observability/all-exceptions.filter.js";
import { HealthController } from "./observability/health.controller.js";
import { RequestLoggerInterceptor } from "./observability/request-logger.interceptor.js";
import { SignupController } from "./signup/signup.controller.js";
import { TelemetryController } from "./telemetry/telemetry.controller.js";
import { UsageController } from "./usage/usage.controller.js";
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
      controllers: [
        WorkspacesController,
        UsageController,
        ContractsController,
        AuditController,
        TelemetryController,
        SignupController,
        AuthController,
        HealthController,
      ],
      providers: [
        ...dbProviders(databaseUrl),
        TenantGuard,
        WorkspacesService,
        // Observability (#97): structured request logs + error logging,
        // applied to every route.
        { provide: APP_INTERCEPTOR, useClass: RequestLoggerInterceptor },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }
}
