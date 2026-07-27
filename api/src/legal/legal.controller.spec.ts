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
});
