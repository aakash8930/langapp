import { LegalController } from './legal.controller';

describe('LegalController', () => {
  let controller: LegalController;

  beforeEach(() => {
    controller = new LegalController();
  });

  it('returns privacy policy markdown', () => {
    const text = controller.getPrivacy();
    expect(text).toContain('# Privacy Policy');
    expect(text).toContain('GDPR / DPDP Compliance');
  });

  it('returns terms of service markdown', () => {
    const text = controller.getTerms();
    expect(text).toContain('# Terms of Service');
    expect(text).toContain('Acceptable Use');
  });

  it('returns privacy policy JSON', () => {
    const json = controller.getPrivacyJson();
    expect(json.title).toBe('Privacy Policy');
    expect(json.content).toContain('Privacy Policy');
  });

  it('returns terms of service JSON', () => {
    const json = controller.getTermsJson();
    expect(json.title).toBe('Terms of Service');
    expect(json.content).toContain('Terms of Service');
  });

  /**
   * The effective date is written twice — in the markdown body a human reads and
   * in the JSON envelope a client reads to show "updated on". Updating one and
   * not the other is a silent lie about when the document changed, and there is
   * nothing else in the codebase that would notice.
   */
  it('states the same effective date in the markdown and the JSON envelope', () => {
    const documents = [
      [controller.getPrivacy(), controller.getPrivacyJson()],
      [controller.getTerms(), controller.getTermsJson()],
    ] as const;

    for (const [markdown, json] of documents) {
      const match = /\*\*Effective Date:\*\* (\w+) (\d{1,2}), (\d{4})/.exec(markdown);
      if (!match) {
        throw new Error(`No effective date in the markdown for ${json.title}`);
      }
      const [, month, day, year] = match;
      const iso = new Date(`${month} ${day}, ${year} UTC`).toISOString().slice(0, 10);
      expect(json.effectiveDate).toBe(iso);
    }
  });

  /**
   * A privacy policy naming data the app does not collect is a factual error, and
   * this one carried "gem counts" for a day after Phase 2 §3.1 deleted gems. The
   * legal text is the last place a removed mechanic tends to survive, because
   * nothing imports it.
   */
  it('does not claim to collect mechanics that no longer exist', () => {
    const text = `${controller.getPrivacy()} ${controller.getTerms()}`.toLowerCase();
    expect(text).not.toContain('gem');
    // 'hearts' survives once as a promise *not* to use them, which is fine —
    // what must not appear is a claim that heart state is collected or stored.
    expect(controller.getPrivacy().toLowerCase()).not.toContain('heart');
  });
});
