/**
 * Signup email hygiene — blocks obviously fake / throwaway addresses BEFORE
 * they ever reach Supabase.
 *
 * NOTE: this is a first line of defence only. The definitive proof that an
 * address is real is EMAIL CONFIRMATION (Supabase → Authentication →
 * Providers → Email → "Confirm email"), which makes the user click a link in
 * their actual inbox. Keep both.
 */

/** Reasonably strict address shape (no spaces, one @, a real TLD). */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/**
 * Disposable / temp-mail providers. These give anyone a working inbox for a
 * few minutes, so they pass verification but are worthless to the business.
 */
const DISPOSABLE_DOMAINS = new Set<string>([
  "10minutemail.com", "10minutemail.net", "20minutemail.com", "33mail.com",
  "anonbox.net", "armyspy.com", "boun.cr", "burnermail.io", "byom.de",
  "cuvox.de", "dayrep.com", "discard.email", "dispostable.com", "dropmail.me",
  "einrot.com", "emailondeck.com", "emailtemporario.com.br", "fakeinbox.com",
  "fakemail.net", "fakemailgenerator.com", "gerdilo.com", "getairmail.com",
  "getnada.com", "grr.la", "guerrillamail.biz", "guerrillamail.com",
  "guerrillamail.de", "guerrillamail.info", "guerrillamail.net",
  "guerrillamail.org", "guerrillamailblock.com", "harakirimail.com",
  "inboxbear.com", "inboxkitten.com", "jetable.org", "mail-temporaire.fr",
  "mail.tm", "mail7.io", "mailcatch.com", "maildrop.cc", "mailduck.io",
  "maileater.com", "mailexpire.com", "mailforspam.com", "mailinator.com",
  "mailinator.net", "mailnesia.com", "mailnull.com", "mailsac.com",
  "mailtemp.info", "mailtothis.com", "meltmail.com", "minuteinbox.com",
  "moakt.com", "mohmal.com", "mt2015.com", "mytemp.email", "nada.email",
  "no-spam.ws", "nowmymail.com", "objectmail.com", "onetimeemail.net",
  "pokemail.net", "rhyta.com", "sharklasers.com", "shitmail.me", "sogetthis.com",
  "spam4.me", "spamgourmet.com", "spambox.us", "spamdecoy.net", "spamfree24.org",
  "spamherelots.com", "superrito.com", "teleworm.us", "temp-mail.io",
  "temp-mail.org", "tempail.com", "tempinbox.com", "tempmail.dev",
  "tempmail.net", "tempmail.plus", "tempmailaddress.com", "tempmailo.com",
  "tempr.email", "thankyou2010.com", "throwawaymail.com", "tmail.ws",
  "tmails.net", "trash-mail.com", "trashmail.com", "trashmail.de",
  "trashmail.me", "trashmail.net", "trbvm.com", "vomoto.com", "wegwerfmail.de",
  "yopmail.com", "yopmail.fr", "yopmail.net", "zetmail.com",
]);

/** Local parts that are obviously placeholders. */
const FAKE_LOCAL_PARTS = new Set<string>([
  "test", "tests", "testing", "test123", "fake", "fakeemail", "dummy",
  "asdf", "asd", "qwerty", "abc", "abcd", "xyz", "aaa", "sample",
  "noemail", "no-email", "none", "nothing", "null", "undefined",
  "example", "user", "someone", "anonymous", "nobody",
]);

/** Domains that are reserved for documentation / never deliver real mail. */
const FAKE_DOMAINS = new Set<string>([
  "example.com", "example.org", "example.net", "test.com", "test.net",
  "fake.com", "fakemail.com", "email.com", "domain.com", "mail.com",
  "abc.com", "asdf.com", "xyz.com", "sample.com", "localhost", "invalid",
  "nowhere.com", "noreply.com", "no-reply.com", "dummy.com", "temp.com",
]);

/** Common typos of the big providers — caught so real users aren't lost. */
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmai.com": "gmail.com", "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com", "gmail.con": "gmail.com", "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com", "gamil.com": "gmail.com", "gmail.om": "gmail.com",
  "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com",
  "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com", "outlok.com": "outlook.com",
  "outloo.com": "outlook.com", "outlook.co": "outlook.com",
  "iclod.com": "icloud.com", "icloud.co": "icloud.com",
};

export interface EmailCheck {
  ok: boolean;
  /** Message to show the user when ok is false. */
  error?: string;
  /** Set when we detect a likely typo, e.g. "Did you mean …@gmail.com?" */
  suggestion?: string;
}

/**
 * Validate a signup email. Returns ok:false with a friendly message for
 * malformed, disposable, placeholder or obviously fake addresses.
 */
export function checkSignupEmail(raw: string): EmailCheck {
  const email = (raw ?? "").trim().toLowerCase();

  if (!email) return { ok: false, error: "Please enter your email address." };
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const [local, domain] = email.split("@");

  // Obvious typo of a major provider → suggest the fix instead of blocking.
  const fixed = DOMAIN_TYPOS[domain];
  if (fixed) {
    return {
      ok: false,
      error: `Did you mean ${local}@${fixed}?`,
      suggestion: `${local}@${fixed}`,
    };
  }

  if (FAKE_DOMAINS.has(domain)) {
    return {
      ok: false,
      error: "Please use your real email address — this domain isn't accepted.",
    };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      ok: false,
      error: "Temporary or disposable email addresses aren't allowed. Please use your real email.",
    };
  }

  // Strip +tags and dots for the placeholder check (test+1@… is still "test").
  const bare = local.split("+")[0].replace(/\./g, "");
  if (FAKE_LOCAL_PARTS.has(bare)) {
    return { ok: false, error: "Please use your real email address." };
  }

  // A local part of only repeated characters (aaaa@, 1111@) is not a real inbox.
  if (/^(.)\1+$/.test(bare) && bare.length >= 3) {
    return { ok: false, error: "Please use your real email address." };
  }

  return { ok: true };
}

/** True when the address passes every fake-email check. */
export function isRealisticEmail(email: string): boolean {
  return checkSignupEmail(email).ok;
}
