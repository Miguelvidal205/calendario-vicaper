import { cookies } from "next/headers";

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(args: { code: string; status: number; message: string }) {
    super(args.message);
    this.name = "ApiError";
    this.code = args.code;
    this.status = args.status;
  }
}

export async function requireActiveTerrenoId(): Promise<string> {
  const store = await cookies();
  const id = store.get("active_terreno_id")?.value;

  if (!id) {
    throw new ApiError({
      code: "NO_ACTIVE_TERRENO",
      status: 400,
      message: "No active terreno selected. Go to /dashboard/onboarding.",
    });
  }
  return id;
}
