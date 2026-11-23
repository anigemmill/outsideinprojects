import { describe, expect, it } from "vitest";
import { loadTargetsConfig } from "./migration-guard";
import { classifyDatabaseUrl, expectedIdentity } from "./migration-target";

/*
  This repository's real config/database-targets.json against every Supabase project known in the
  ecosystem (docs/environments.md). Only the account service's own development project may be
  accepted; every other product's project, and every old or unrelated one, must be refused.
*/
const KNOWN: Record<string, string> = {
  urdrrzqqtmeuwlxksuov: "accounts-dev (account service, current)",
  jzshbaqfrrgsyiciuzfe: "reeldeal (Reel Deal production)",
  hescoabpcjukmgeopjnq: "Tourism-AI-Growth-Platform (Findable production)",
  sgllcpzdynjraflbxbzz: "supabase-coquelicot-branch",
  egtlqrmujhxelczbyszj: "old accounts-dev (gone)",
  xmqivpwwdksahxkkamgm: "first accounts-dev (deleted)",
  ahclyplubhkhggonkfnj: "Tokyo project (unused)",
};
const ACCEPTED = { urdrrzqqtmeuwlxksuov: "development" } as const;

const direct = (ref: string) => `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;
const pooler = (ref: string) => `postgresql://postgres.${ref}:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres`;

describe("config/database-targets.json", () => {
  const config = loadTargetsConfig();

  it("names this product and only the expected projects", () => {
    expect(config.product).toBe("account_service");
    expect(config.projects).toEqual({ development: "urdrrzqqtmeuwlxksuov" });
  });

  for (const [ref, label] of Object.entries(KNOWN)) {
    const expected = ACCEPTED[ref as keyof typeof ACCEPTED];
    it(`${expected ? "accepts" : "refuses"} ${label}`, () => {
      for (const url of [direct(ref), pooler(ref)]) {
        if (expected) expect(expectedIdentity(classifyDatabaseUrl(url), config)).toEqual({ product: "account_service", environment: expected, project_ref: ref });
        else expect(() => expectedIdentity(classifyDatabaseUrl(url), config)).toThrow(/Refusing to migrate/);
      }
    });
  }
});
