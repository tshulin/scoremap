import { describe, expect, it } from 'vitest';
import { extractPortalDomain, isPortalDomain } from './domainInput';
import { validatePortalDomain } from './login';

describe('extractPortalDomain', () => {
	it('accepts a bare hostname as-is', () => {
		expect(extractPortalDomain('ca-sfu-psv.edupoint.com')).toBe('ca-sfu-psv.edupoint.com');
	});

	it('strips the scheme, with or without a trailing slash', () => {
		expect(extractPortalDomain('https://ca-sfu-psv.edupoint.com')).toBe('ca-sfu-psv.edupoint.com');
		expect(extractPortalDomain('http://ca-sfu-psv.edupoint.com/')).toBe('ca-sfu-psv.edupoint.com');
		expect(extractPortalDomain('//ca-sfu-psv.edupoint.com/')).toBe('ca-sfu-psv.edupoint.com');
	});

	it('handles a URL copied from the grades page (path + query + fragment)', () => {
		expect(extractPortalDomain('https://ca-sfu-psv.edupoint.com/PXP2_Gradebook.aspx?AGU=0')).toBe(
			'ca-sfu-psv.edupoint.com'
		);
		expect(extractPortalDomain('ca-sfu-psv.edupoint.com/PXP2_Gradebook.aspx#focus')).toBe(
			'ca-sfu-psv.edupoint.com'
		);
		expect(
			extractPortalDomain('https://ca-sfu-psv.edupoint.com/PXP2_Login_Student.aspx?regenerateSessionId=True')
		).toBe('ca-sfu-psv.edupoint.com');
	});

	it('is case-insensitive and tolerates surrounding whitespace', () => {
		expect(extractPortalDomain('  HTTPS://CA-SFU-PSV.EDUPOINT.COM/Home_PXP2.aspx  ')).toBe(
			'ca-sfu-psv.edupoint.com'
		);
	});

	it('keeps a base path but drops the page file (shared-server portals)', () => {
		expect(extractPortalDomain('https://studentvue.geneseeisd.org/wpa/PXP2_Login_Student.aspx')).toBe(
			'studentvue.geneseeisd.org/wpa'
		);
		expect(extractPortalDomain('studentvue.geneseeisd.org/wpa/')).toBe('studentvue.geneseeisd.org/wpa');
		expect(extractPortalDomain('https://sisstudent.fcps.edu/SVUE/')).toBe('sisstudent.fcps.edu/svue');
	});

	it('drops ports and trailing dots', () => {
		expect(extractPortalDomain('https://ca-sfu-psv.edupoint.com:443/PXP2_Gradebook.aspx')).toBe(
			'ca-sfu-psv.edupoint.com'
		);
		expect(extractPortalDomain('portal.sfusd.edu.')).toBe('portal.sfusd.edu');
	});

	it('finds the link inside surrounding text', () => {
		expect(
			extractPortalDomain('my school link is https://az-alc.edupoint.com/PXP2_Login_Student.aspx ok')
		).toBe('az-alc.edupoint.com');
	});

	it('returns null when nothing hostname-shaped is there', () => {
		expect(extractPortalDomain('')).toBeNull();
		expect(extractPortalDomain('   ')).toBeNull();
		expect(extractPortalDomain('grademax')).toBeNull();
		expect(extractPortalDomain('https://')).toBeNull();
	});
});

describe('isPortalDomain / validatePortalDomain', () => {
	it('accepts hosts and hosts with a base path', () => {
		expect(isPortalDomain('ca-sfu-psv.edupoint.com')).toBe(true);
		expect(isPortalDomain('studentvue.geneseeisd.org/wpa')).toBe(true);
		expect(() => validatePortalDomain('rt2.region1.k12.mn.us/rt2910')).not.toThrow();
	});

	it('rejects schemes, ports, spaces, and dotless names', () => {
		expect(isPortalDomain('https://ca-sfu-psv.edupoint.com')).toBe(false);
		expect(isPortalDomain('ca-sfu-psv.edupoint.com:8080')).toBe(false);
		expect(isPortalDomain('bad domain.com')).toBe(false);
		expect(isPortalDomain('localhost')).toBe(false);
		expect(() => validatePortalDomain('https://x.com')).toThrow(/Invalid portal domain/);
	});
});
