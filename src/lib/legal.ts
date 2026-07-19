// Rego legal & customer-protection policy pack.
// Source: REGO_Legal_Policy_Pack.docx (effective 13 July 2026).
// Email/domain placeholders are filled with rego.services defaults; the
// remaining bracketed placeholders (legal entity, registration, address,
// jurisdiction, fees, payment processors, phone) must be completed by Rego /
// its lawyer before final publication.
//
// The array below is the built-in DEFAULT. Admins can override any policy from
// the admin panel; edits are stored in the `legal_content` table (phase55) and
// merged over these defaults by slug.

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface LegalSection {
  heading?: string;
  body: string[];
}

export interface LegalPolicy {
  slug: string;
  title: string;
  summary: string;
  intro: string[];
  sections: LegalSection[];
}

export const LEGAL_EFFECTIVE = "13 July 2026";

export const LEGAL_DISCLAIMER =
  "This is a practical launch draft, not a substitute for advice from a licensed Pakistani lawyer. Rego must complete every remaining placeholder and make the text match its actual operations before final publication. Prepared with reference to Pakistan's Electronic Transactions Ordinance 2002, the Prevention of Electronic Crimes Act 2016, and the Gilgit-Baltistan Travel Agencies & Tour Operators Act 2020.";

export const legalPolicies: LegalPolicy[] = [
  {
    slug: "terms",
    title: "Terms and Conditions",
    summary: "The rules that govern your use of the Rego platform and marketplace.",
    intro: [
      "These Terms and Conditions govern access to and use of the Rego website, mobile applications, dashboards, maps, artificial-intelligence tools, booking features, community features and related services (collectively, the “Platform”).",
    ],
    sections: [
      {
        heading: "1. About Rego",
        body: [
          "Rego is operated by [LEGAL ENTITY NAME], registration number [COMPANY REGISTRATION NUMBER], with its registered office at [REGISTERED OFFICE ADDRESS] (“Rego”, “we”, “us” or “our”).",
          "Rego provides a digital tourism marketplace through which travelers may discover, compare, request, reserve or book travel-related services offered by independent hotels, guest houses, tour operators, guides, transport providers, restaurants, activity companies, photographers, rental businesses and other service providers (“Providers”).",
          "Unless a service is expressly identified as being supplied directly by Rego, the Provider—not Rego—is responsible for delivering that travel service. Rego facilitates discovery, communication, booking and, where stated, payment.",
        ],
      },
      {
        heading: "2. Acceptance and eligibility",
        body: [
          "By accessing the Platform, creating an account, making a booking, submitting content or registering as a Provider, you agree to these Terms and the policies incorporated by reference.",
          "You must be at least 18 years old and legally capable of entering into a binding agreement. A parent or legal guardian must make and supervise bookings for minors.",
          "If you use Rego on behalf of a company or other organization, you confirm that you are authorized to bind that organization.",
        ],
      },
      {
        heading: "3. Accounts and account security",
        body: [
          "You must provide accurate, current and complete information and keep it updated.",
          "You are responsible for maintaining the confidentiality of your password, one-time codes and account access. Tell Rego immediately if you suspect unauthorized use.",
          "Rego may request identity, business, licensing or payment verification and may suspend access while verification is pending.",
        ],
      },
      {
        heading: "4. Marketplace role and Provider responsibility",
        body: [
          "Providers are independent businesses and are not employees, agents, branches or partners of Rego merely because they are listed on the Platform.",
          "A “Verified” badge means Rego has completed the checks described on the Platform at that time. It is not a guarantee of quality, safety, licensing status, financial condition or future performance.",
          "Providers are responsible for their descriptions, prices, availability, taxes, permits, insurance, staff, vehicles, equipment, safety standards and fulfillment of confirmed services.",
        ],
      },
      {
        heading: "5. Listings, prices and availability",
        body: [
          "Rego aims to display accurate information, but travel information can change quickly. Prices, taxes, fees, schedules, routes, photos, amenities and availability are supplied by Providers or third parties and may be corrected where an obvious error occurs.",
          "The total amount and any known mandatory charges should be shown before the traveler confirms a booking. Currency conversion estimates are informational; the final exchange rate may be set by the traveler's bank, wallet or payment processor.",
          "Special requests are not guaranteed unless accepted in writing by the Provider.",
        ],
      },
      {
        heading: "6. Booking formation",
        body: [
          "A submitted request is not a confirmed booking unless the Platform or Provider issues a confirmation marked “Confirmed” or equivalent.",
          "When a booking is confirmed, a contract for the travel service is formed between the traveler and the Provider, subject to the listing terms, the Booking Policy, the applicable cancellation conditions and mandatory law.",
          "Where Rego sells a service directly, the confirmation will identify Rego as the supplier.",
        ],
      },
      {
        heading: "7. Payments",
        body: [
          "Payment may be collected by Rego, [PAYMENT PROCESSOR(S)] or the Provider, as stated during checkout.",
          "You authorize the relevant party to charge the displayed amount and any later amount you expressly approve. Rego does not intentionally store complete payment-card details when payment is handled by an external processor.",
          "You must not use stolen, unauthorized or fraudulent payment methods. Rego may cancel a suspicious transaction, request further verification or cooperate with payment institutions and authorities.",
        ],
      },
      {
        heading: "8. Cancellations, no-shows and refunds",
        body: [
          "The Booking Policy, Cancellation Policy and Refund Policy form part of these Terms.",
          "Booking-specific cancellation terms displayed before confirmation take priority over general cancellation terms, except where mandatory law provides greater protection.",
          "Failure to arrive, late arrival, failure to carry required documents or refusal of service caused by a traveler's conduct may result in charges or loss of refund eligibility.",
        ],
      },
      {
        heading: "9. Traveler responsibilities",
        body: [
          "Travelers must review booking details, meet visa and entry requirements, carry valid identification and permits, assess fitness for planned activities, follow safety instructions and respect local laws, culture, communities and the environment.",
          "Travelers must disclose information reasonably necessary for safe service delivery, including relevant accessibility needs, age restrictions or medical considerations, without providing unnecessary sensitive details.",
          "Travelers must behave lawfully and must not threaten, harass, discriminate against, damage property of or endanger Providers, staff, communities or other travelers.",
        ],
      },
      {
        heading: "10. Rego Map, road updates, weather and emergency information",
        body: [
          "Maps, route information, road status, weather, emergency locations, distance estimates and community reports are provided for planning convenience. Conditions may change without notice and data may be delayed, incomplete or inaccurate.",
          "Do not rely on the Platform as the sole source for mountain routes, road safety, rescue, weather warnings or emergencies. Confirm critical information with local authorities, rescue services, Providers and official sources.",
          "Rego is not an emergency-response service. In an emergency, contact the relevant police, medical, rescue or disaster-management authority immediately.",
        ],
      },
      {
        heading: "11. Rego AI",
        body: [
          "Rego AI may produce automated recommendations, itineraries, estimates and answers. Outputs may be incomplete or incorrect and do not constitute legal, medical, financial, immigration, safety or professional advice.",
          "Prices, availability, road status and booking terms must be confirmed through the relevant listing, Provider or official source before action is taken.",
          "Do not submit highly sensitive personal information, passwords, full payment credentials or unnecessary medical information to Rego AI.",
        ],
      },
      {
        heading: "12. Safarnama and user content",
        body: [
          "You retain ownership of original stories, photographs, videos, reviews and other content you submit. You grant Rego a non-exclusive, worldwide, royalty-free license to host, reproduce, format, translate, display, distribute and promote that content in connection with operating and marketing Rego, subject to your privacy settings and applicable law.",
          "You confirm that you own the content or have permission to use it and that it does not violate privacy, copyright, trademark, publicity or other rights.",
          "Rego may remove or restrict content that violates these Terms, the Review Policy, law, safety requirements or the rights of others.",
        ],
      },
      {
        heading: "13. Prohibited use",
        body: [
          "You must not misuse the Platform; scrape or copy it without authorization; bypass security; upload malware; create fake accounts or bookings; manipulate reviews; impersonate others; commit fraud; collect personal data unlawfully; promote illegal services; or use the Platform to harass, exploit or endanger any person.",
          "Automated access is permitted only with Rego's written authorization or through an approved interface.",
        ],
      },
      {
        heading: "14. Intellectual property",
        body: [
          "The Rego name, logo, visual identity, software, interface, databases, text and original platform content are owned by or licensed to Rego and are protected by applicable intellectual-property laws.",
          "No right is granted to use Rego branding, copy listings at scale, reverse engineer software or create a confusingly similar service except with written permission.",
        ],
      },
      {
        heading: "15. Third-party services and links",
        body: [
          "The Platform may connect to payment gateways, map providers, airlines, social networks, messaging services and other third parties. Their terms and privacy practices apply to their services.",
          "Rego is not responsible for a third-party website or service merely because it is linked from the Platform.",
        ],
      },
      {
        heading: "16. Disclaimers and limitation of liability",
        body: [
          "The Platform is provided on an “as available” basis. To the fullest extent permitted by law, Rego does not guarantee uninterrupted access, error-free content, constant availability or the conduct and performance of every Provider or traveler.",
          "To the fullest extent permitted by law, Rego will not be liable for indirect, incidental, special or consequential loss, loss of profit, loss of opportunity or loss caused by events outside reasonable control.",
          "Where Rego is legally liable in connection with a booking that Rego did not directly supply, its aggregate liability will not exceed the amount of service fees actually paid to Rego for that booking, unless mandatory law requires otherwise.",
          "Nothing in these Terms excludes liability that cannot lawfully be excluded, including liability for fraud, willful misconduct or any mandatory consumer right.",
        ],
      },
      {
        heading: "17. Indemnity",
        body: [
          "You agree to compensate Rego for reasonable losses, claims and expenses arising from your unlawful use of the Platform, breach of these Terms, infringement of another person's rights or content you submit, except to the extent caused by Rego's own unlawful conduct.",
        ],
      },
      {
        heading: "18. Suspension and termination",
        body: [
          "Rego may warn, restrict, suspend or terminate an account or listing where reasonably necessary for safety, fraud prevention, legal compliance, non-payment, repeated complaints or breach of Platform rules.",
          "Where practical, Rego will explain the reason and provide a review channel. Immediate action may be taken where delay could create risk.",
        ],
      },
      {
        heading: "19. Complaints and disputes",
        body: [
          "Contact support@rego.services or [PHONE / WHATSAPP] with the booking reference and supporting information. Rego will try to resolve complaints fairly with the traveler and Provider.",
          "If a dispute is not resolved through support, the parties should attempt good-faith settlement before court proceedings. These Terms are governed by the laws applicable in Pakistan and disputes are subject to [COURTS / JURISDICTION], unless mandatory law requires another forum.",
        ],
      },
      {
        heading: "20. Changes and contact",
        body: [
          "Rego may update these Terms to reflect legal, operational or product changes. Material changes will be communicated through the Platform or by email where appropriate. The effective date will be updated.",
          "Legal notices may be sent to legal@rego.services or [REGISTERED OFFICE ADDRESS].",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "How Rego collects, uses, shares and protects your personal information.",
    intro: [
      "This Privacy Policy explains how Rego collects, uses, shares, stores and protects personal information when travelers, Providers and visitors use the Platform.",
    ],
    sections: [
      {
        heading: "1. Who is responsible for your information",
        body: [
          "The primary operator and data controller is [LEGAL ENTITY NAME], located at [REGISTERED OFFICE ADDRESS]. Privacy questions may be sent to privacy@rego.services.",
          "For a Provider's independent service, that Provider may separately control information needed to deliver the booking. Its own privacy notice may also apply.",
        ],
      },
      {
        heading: "2. Information we collect",
        body: [
          "Account and identity information, such as name, email, phone number, date of birth where required, profile photo, nationality or identity documents used for verification.",
          "Booking and service information, such as destination, dates, guests, preferences, communications, special requests, booking history, cancellations and complaints.",
          "Provider information, such as business ownership, registration, licenses, tax information, bank or payout information, addresses, staff contacts, listings and verification documents.",
          "Payment and transaction information, such as payment status, amount, currency, processor reference, refunds and fraud signals. Complete card details are generally handled by the relevant payment processor rather than stored by Rego.",
          "Location information, when permission is granted, including approximate or precise device location for nearby services, navigation, roadside help or map functions.",
          "Device and usage information, including IP address, browser, device identifiers, operating system, pages viewed, clicks, session activity, diagnostic logs and cookie identifiers.",
          "Content and communications, including support messages, calls or chat records where lawfully recorded, reviews, Safarnama posts, images, videos and Provider responses.",
          "Information from third parties, including Providers, payment processors, identity-verification vendors, map services, analytics tools, public sources and people making a booking on your behalf.",
        ],
      },
      {
        heading: "3. How we use information",
        body: [
          "To create accounts, display listings, process booking requests, facilitate payments, send confirmations and enable communication between travelers and Providers.",
          "To verify identities and businesses, prevent fraud, protect accounts, investigate misuse, enforce policies and respond to safety incidents.",
          "To provide customer support, handle cancellations, refunds, disputes and complaints, and maintain transaction records.",
          "To operate and improve search, recommendations, Rego AI, Rego Map, road updates, accessibility, personalization, analytics and Platform performance.",
          "To send essential service communications and, with consent where required, marketing messages, offers, surveys and partner promotions.",
          "To comply with legal obligations, lawful authority requests, tax, accounting, audit, licensing and dispute-resolution requirements.",
        ],
      },
      {
        heading: "4. Basis for processing",
        body: [
          "Depending on the activity and applicable law, Rego processes information because it is necessary to provide a requested service or perform a contract; because the user has given consent; because Rego has a legitimate operational, security or improvement interest; or because processing is required by law.",
          "Where consent is used, it may be withdrawn for future processing through the relevant setting or by contacting Rego. Withdrawal does not invalidate processing completed before withdrawal.",
        ],
      },
      {
        heading: "5. How we share information",
        body: [
          "With Providers and travelers as necessary to request, confirm and fulfill bookings. This may include names, contact details, dates, guest details and special requests.",
          "With payment processors, banks, wallets, payout providers and fraud-prevention services to complete transactions.",
          "With hosting, cloud, communications, customer-support, identity-verification, mapping, analytics, security and marketing vendors acting under contractual or legal obligations.",
          "With professional advisers, insurers, auditors and potential investors or buyers in a legitimate corporate transaction, subject to confidentiality safeguards.",
          "With authorities or other parties where reasonably necessary to comply with law, protect rights and safety, investigate fraud or respond to emergencies.",
          "Rego does not sell personal information for money. Rego will not share personal information for unrelated third-party advertising without the notice or consent required by applicable law.",
        ],
      },
      {
        heading: "6. International data transfers",
        body: [
          "Rego may use Providers and technology vendors located in Pakistan or other countries. Data-protection standards may differ between countries.",
          "Where required, Rego will use appropriate contractual, technical or organizational safeguards and limit transfers to information necessary for the stated purpose.",
        ],
      },
      {
        heading: "7. Data retention",
        body: [
          "Rego keeps information only for as long as reasonably necessary for bookings, support, security, legal, tax, accounting, dispute and legitimate business purposes.",
          "Retention periods vary by record type. Account data is generally retained while the account is active; transaction and compliance records may be retained longer where law or dispute risk requires it; marketing preferences are retained until changed or no longer needed.",
          "Information may be anonymized or aggregated so it can no longer reasonably identify an individual, after which it may be used for analytics and planning.",
        ],
      },
      {
        heading: "8. Security",
        body: [
          "Rego uses reasonable administrative, technical and physical measures designed to protect information, including access controls, authentication, encryption where appropriate, logging, backups and vendor controls.",
          "No internet service is completely secure. Users must protect their credentials and avoid sending sensitive information through unsecured channels.",
          "Where a security incident creates a material risk, Rego will investigate, contain it and provide notices required by applicable law.",
        ],
      },
      {
        heading: "9. Your choices and rights",
        body: [
          "You may request access to, correction of or deletion of personal information, object to or restrict certain uses, withdraw consent, request account closure or ask for a portable copy where these rights apply.",
          "Some information may be retained where needed for legal obligations, fraud prevention, transactions, disputes or the rights of others.",
          "You may disable location access in device settings, unsubscribe from promotional email through the message link, change notification settings and manage cookies through the consent tool or browser.",
          "Rego may request identity verification before completing a privacy request. Send requests to privacy@rego.services.",
        ],
      },
      {
        heading: "10. Children",
        body: [
          "Rego is not intended for independent use by children under 18. A parent or guardian must make bookings and provide required information for a minor.",
          "If Rego learns that a child submitted personal information without appropriate authorization, Rego will take reasonable steps to delete or restrict it.",
        ],
      },
      {
        heading: "11. Public content",
        body: [
          "Reviews, profile information and Safarnama posts selected as public may be visible to other users and search engines. Do not publish identity documents, private addresses, payment details or information about another person without permission.",
          "Deleting content may not immediately remove copies already shared, cached, legally retained or included in transaction records.",
        ],
      },
      {
        heading: "12. Cookies and similar technology",
        body: [
          "Rego uses cookies and similar tools as described in the Cookie Policy. Non-essential analytics or advertising technologies should be used only in accordance with the consent choices required by applicable law.",
        ],
      },
      {
        heading: "13. Third-party services",
        body: [
          "Third-party payment, map, social-login, messaging and booking services may collect information under their own privacy notices. Review those notices before using the relevant feature.",
        ],
      },
      {
        heading: "14. Changes and contact",
        body: [
          "Rego may update this Policy and will show the revised effective date. Material changes will be highlighted where appropriate.",
          "Privacy contact: privacy@rego.services. Postal contact: [REGISTERED OFFICE ADDRESS].",
        ],
      },
    ],
  },
  {
    slug: "booking",
    title: "Booking Policy",
    summary: "How booking requests, confirmations, payments, changes and service delivery work.",
    intro: [
      "This Booking Policy explains how booking requests, confirmations, payments, changes and service delivery work on Rego.",
    ],
    sections: [
      {
        heading: "1. Booking types",
        body: [
          "A listing may support instant confirmation, provider approval, inquiry-only contact or offline payment. The booking page will identify the applicable method.",
          "A request remains pending until the traveler receives a confirmation marked “Confirmed” or equivalent. An automated receipt only confirms that Rego received the request unless it expressly confirms the service.",
        ],
      },
      {
        heading: "2. Traveler information",
        body: [
          "The traveler must provide accurate names, phone numbers, email addresses, dates, guest counts, pickup details and other information requested for the service.",
          "Names for flights, permits, insurance or regulated services must match the relevant identification document.",
          "The person making a booking for others is responsible for obtaining permission to provide their information and for communicating the booking terms to them.",
        ],
      },
      {
        heading: "3. Prices and charges",
        body: [
          "The Platform should show the base price, known mandatory taxes and fees, Rego service fees, Provider charges and payment schedule before confirmation.",
          "Optional extras, security deposits, local taxes payable at destination, damage charges or variable usage charges must be clearly described by the Provider.",
          "If a displayed price is obviously incorrect, Rego or the Provider may cancel or offer the correct price before service begins. No additional charge will be taken without authorization.",
        ],
      },
      {
        heading: "4. Confirmation and availability",
        body: [
          "Availability is not guaranteed until confirmation. Providers must keep inventory current, but overlapping bookings, technical delays or emergencies may occur.",
          "If a Provider cannot honor a confirmed booking, it must promptly notify Rego and the traveler and cooperate in offering a suitable alternative or refund under the applicable policies.",
        ],
      },
      {
        heading: "5. Payment",
        body: [
          "Payment may be full, partial, deposit-based, pay-at-property or directly arranged with the Provider, as displayed at checkout.",
          "The traveler must use an authorized payment method and complete any verification. A booking may be cancelled if payment is not completed by the stated deadline.",
          "Rego will issue or facilitate an electronic receipt or booking record. Travelers should retain it.",
        ],
      },
      {
        heading: "6. Special requests and accessibility",
        body: [
          "Requests concerning beds, meals, accessibility, child seats, guides, dietary needs, pickup times or celebrations are subject to Provider acceptance.",
          "Travelers should contact the Provider before booking where a requirement is essential to safe or usable service. A request is confirmed only when accepted in writing.",
        ],
      },
      {
        heading: "7. Changes to a booking",
        body: [
          "Date, route, guest, room, vehicle, activity or name changes are subject to availability, Provider approval and any fare difference or change fee.",
          "A change request does not cancel the existing booking until Rego or the Provider confirms the change or cancellation.",
          "For flights, permits and other third-party inventory, supplier rules may prohibit changes or require new tickets.",
        ],
      },
      {
        heading: "8. Arrival, check-in and service use",
        body: [
          "Travelers must follow the stated check-in, pickup, meeting and reporting times and carry required identification, vouchers, permits and safety equipment.",
          "Late arrival may shorten or cancel a service without refund where the Provider cannot reasonably delay other guests or operations.",
          "Providers may refuse service where legally permitted for safety, intoxication, abusive conduct, lack of documents, non-payment or serious rule violations.",
        ],
      },
      {
        heading: "9. Provider changes",
        body: [
          "Providers may make reasonable operational changes such as vehicle, guide, room or itinerary adjustments where the substitute is materially comparable and safety or circumstances require it.",
          "Material changes must be communicated promptly. The traveler may be entitled to an alternative, price adjustment, cancellation or refund depending on the change and applicable policy.",
        ],
      },
      {
        heading: "10. Communication and records",
        body: [
          "Use Rego messaging or the contact details in the booking confirmation for important communication. Keep evidence of agreed changes and payments.",
          "Rego may send service notices by email, SMS, in-app notification or WhatsApp where the user has provided the number and applicable permission.",
        ],
      },
      {
        heading: "11. Complaints after service",
        body: [
          "Raise problems with the Provider immediately where possible so they have an opportunity to correct them.",
          "Unresolved complaints should be sent to support@rego.services with the booking number, description and supporting evidence as soon as reasonably possible.",
        ],
      },
      {
        heading: "12. Policy priority",
        body: [
          "The booking confirmation and clearly displayed listing-specific rules apply first; then this Booking Policy, Cancellation Policy, Refund Policy and Terms and Conditions; mandatory law prevails over all contractual terms.",
        ],
      },
    ],
  },
  {
    slug: "cancellation",
    title: "Cancellation Policy",
    summary: "When and how bookings can be cancelled, and what charges may apply.",
    intro: [
      "This Cancellation Policy applies to bookings made through Rego. Each listing may have its own cancellation window and charges, which must be shown before confirmation.",
    ],
    sections: [
      {
        heading: "1. How to cancel",
        body: [
          "Cancel through the account booking page where available or contact support@rego.services and the Provider using the booking reference.",
          "A cancellation is effective only when the Platform or authorized support channel confirms receipt. The cancellation time is recorded in the local time zone of the service location unless stated otherwise.",
        ],
      },
      {
        heading: "2. Booking-specific rules",
        body: [
          "Flexible, partially refundable, non-refundable and custom cancellation terms may be offered. The selected rate or package rules shown before purchase apply.",
          "Where a package contains several services, each component may have different supplier terms. The confirmation should identify any non-refundable component.",
        ],
      },
      {
        heading: "3. Traveler cancellation",
        body: [
          "If cancellation occurs within the free-cancellation period, amounts eligible under the booking terms will be refunded.",
          "After the free-cancellation deadline, the Provider may charge the stated percentage, first night, deposit, fixed fee or full amount.",
          "Convenience, payment-processing, permit, insurance, visa, ticketing or third-party charges may be non-refundable where already incurred and clearly disclosed.",
        ],
      },
      {
        heading: "4. No-show and late arrival",
        body: [
          "A traveler who does not arrive or contact the Provider by the stated deadline may be treated as a no-show and charged according to the booking terms.",
          "For multi-day services, failure to use the first segment may cancel later segments where supplier rules say so.",
        ],
      },
      {
        heading: "5. Provider cancellation",
        body: [
          "A Provider that cannot deliver a confirmed service must notify Rego and the traveler immediately.",
          "The traveler will be offered, where reasonably possible, a comparable alternative at no additional service price or a refund of amounts paid for the undelivered service.",
          "Rego may suspend Providers that repeatedly cancel without valid reason or fail to assist affected travelers.",
        ],
      },
      {
        heading: "6. Weather, roads and force majeure",
        body: [
          "Mountain travel may be affected by weather, landslides, road closure, flood, avalanche, political restrictions, strikes, public-health events, natural disaster or other events outside reasonable control.",
          "The Provider may modify, postpone or cancel for safety. Refund or credit eligibility depends on recoverable supplier costs, the booking terms and mandatory law.",
          "A traveler's decision not to travel due only to personal concern is treated as traveler cancellation unless an official restriction or the booking terms provide otherwise.",
        ],
      },
      {
        heading: "7. Partial use and early departure",
        body: [
          "Unused nights, transport segments, meals or activities are not automatically refundable after service has started, especially where the Provider reserved capacity or incurred costs.",
          "A refund may be considered where the Provider materially failed to provide the confirmed service and did not offer a reasonable remedy.",
        ],
      },
      {
        heading: "8. Cancellation due to conduct or safety",
        body: [
          "A Provider may cancel or stop service for dangerous, unlawful, abusive or materially disruptive conduct. Refunds may be denied to the extent permitted by law and the Provider may claim documented damage or loss.",
        ],
      },
      {
        heading: "9. Group and custom bookings",
        body: [
          "Groups, expeditions, customized tours, events and corporate bookings may require deposits and longer cancellation deadlines because Providers reserve staff, vehicles, rooms, permits and equipment.",
          "The custom quotation or contract controls where it clearly states cancellation terms.",
        ],
      },
      {
        heading: "10. Disputes",
        body: [
          "Contact support@rego.services with supporting documents. Rego will review the displayed booking terms, communications, payment record and Provider evidence before deciding any Platform-administered cancellation issue.",
        ],
      },
    ],
  },
  {
    slug: "refund",
    title: "Refund Policy",
    summary: "When refunds are available, how to request them, and how they are processed.",
    intro: [
      "This Refund Policy explains when and how refunds are handled for bookings made through Rego.",
    ],
    sections: [
      {
        heading: "1. Refund eligibility",
        body: [
          "A refund may be available where the booking terms permit cancellation; a Provider cancels; a duplicate or incorrect charge occurs; a confirmed service is not supplied; a material change is rejected; or mandatory law requires a refund.",
          "Non-refundable rates, used services, no-shows, late cancellations, traveler-caused service refusal and costs already paid to third parties may not qualify, subject to mandatory law.",
        ],
      },
      {
        heading: "2. How to request a refund",
        body: [
          "Submit the request through the booking page or to support@rego.services with the booking reference, reason and supporting evidence.",
          "Requests involving service quality should be raised during the service where possible, then escalated promptly if unresolved.",
        ],
      },
      {
        heading: "3. Review process",
        body: [
          "Rego may ask the traveler and Provider for communications, receipts, photographs, location information or other relevant evidence.",
          "Rego will apply the booking-specific terms, these policies and mandatory law. Complex disputes may take longer where information is incomplete or a third-party supplier must approve the refund.",
        ],
      },
      {
        heading: "4. Refund amount",
        body: [
          "The refund may be full or partial depending on the unused service, cancellation charge, supplier cost, discount allocation, tax treatment and payment fee disclosed at booking.",
          "Where only part of a package fails, the refund will normally relate to the affected part rather than the entire trip, unless the failure defeats the main purpose of the booking.",
        ],
      },
      {
        heading: "5. Method and timing",
        body: [
          "Approved refunds will normally be initiated within 7–14 business days after approval, unless the relevant supplier or payment method requires longer.",
          "Refunds are generally returned to the original payment method. Bank, card, wallet or international transfer processing may add additional time outside Rego's control.",
          "Cash or direct-to-Provider payments may need to be refunded by the Provider. Rego will facilitate communication but cannot reverse funds it never received.",
        ],
      },
      {
        heading: "6. Currency and bank charges",
        body: [
          "The refunded amount is processed in the transaction currency where possible. Exchange-rate movement, receiving-bank fees and foreign transaction charges may cause the amount received to differ from the original local-currency value.",
          "Rego does not reimburse independent bank or currency-conversion charges unless legally required or caused by Rego's error.",
        ],
      },
      {
        heading: "7. Credits and vouchers",
        body: [
          "A travel credit or voucher may be offered, but it will not replace a cash refund where the traveler is legally or contractually entitled to money and does not agree to credit.",
          "Voucher validity, transferability and restrictions must be stated when offered.",
        ],
      },
      {
        heading: "8. Chargebacks",
        body: [
          "Contact Rego before initiating a payment dispute so the issue can be investigated quickly.",
          "A legitimate chargeback right is not restricted. However, knowingly false, duplicate or abusive disputes may lead to account restriction and recovery of documented losses.",
        ],
      },
      {
        heading: "9. Provider reimbursement",
        body: [
          "Where Rego refunds a traveler because of a Provider's cancellation, misrepresentation or failure, the Provider must reimburse Rego or permit deduction from future payouts as allowed by the Provider Agreement.",
        ],
      },
      {
        heading: "10. Contact",
        body: [
          "Refund support: support@rego.services, [PHONE / WHATSAPP]. Include the booking reference in all communication.",
        ],
      },
    ],
  },
  {
    slug: "provider-agreement",
    title: "Provider Agreement",
    summary: "The terms for businesses and individuals that list and deliver services on Rego.",
    intro: [
      "This Provider Agreement applies to businesses and individuals that list, offer or deliver tourism-related services through Rego. Commercial details may also be set out in a separate order form or fee schedule.",
    ],
    sections: [
      {
        heading: "1. Provider identity and authority",
        body: [
          "The Provider confirms that it is legally established where required, has authority to enter this Agreement and has provided accurate ownership, contact, tax, payout and business information.",
          "The Provider must maintain all registrations, licenses, permits, approvals, qualifications, vehicle documents, insurance and other authorizations required for its services, including requirements applicable to travel agencies and tour operators in Gilgit-Baltistan.",
          "The Provider must promptly notify Rego of any suspension, expiry, investigation, material complaint, ownership change or event affecting its right or ability to operate.",
        ],
      },
      {
        heading: "2. Verification",
        body: [
          "Rego may verify identity, business records, licenses, bank details, location, facilities, vehicles, staff, references and public information.",
          "The Provider authorizes reasonable verification and must not display a Rego Verified badge outside the Platform without written approval.",
          "Verification does not transfer responsibility for service quality, legal compliance or safety from the Provider to Rego.",
        ],
      },
      {
        heading: "3. Listings and content",
        body: [
          "The Provider must keep names, descriptions, categories, photos, amenities, locations, prices, taxes, schedules, capacity, accessibility, policies and contact information accurate and current.",
          "The Provider must own or have permission to use all submitted content and grants Rego a non-exclusive, worldwide, royalty-free license to host, format, translate, display, distribute and promote it for Platform operation and marketing.",
          "Misleading prices, fake scarcity, copied photos, false credentials, duplicate listings and manipulation of ranking or reviews are prohibited.",
        ],
      },
      {
        heading: "4. Inventory, rates and booking acceptance",
        body: [
          "The Provider must maintain accurate availability and promptly accept, reject or respond to requests within the displayed response time.",
          "A confirmed booking must be honored at the confirmed price and material terms. The Provider may not demand undisclosed charges or move the traveler off-platform to avoid fees after receiving the booking through Rego.",
          "Where a confirmed service cannot be supplied, the Provider must notify Rego immediately and assist with a comparable alternative or refund.",
        ],
      },
      {
        heading: "5. Service standards and traveler treatment",
        body: [
          "The Provider must deliver services professionally, safely, lawfully and without unlawful discrimination; maintain clean and serviceable facilities, vehicles and equipment; use qualified staff; and follow applicable health, food, transport, labor, environmental and tourism rules.",
          "Emergency procedures, risk briefings, age restrictions, fitness requirements, required equipment and exclusions must be clearly communicated before service.",
          "The Provider must respect traveler privacy and may use booking information only to deliver the service, communicate about it, meet legal duties or as otherwise authorized.",
        ],
      },
      {
        heading: "6. Prices, taxes and fees",
        body: [
          "The Provider is responsible for setting lawful rates, disclosing mandatory fees and collecting or remitting taxes for which it is responsible.",
          "Rego fees are described in [PROVIDER COMMISSION / FEE SCHEDULE]. Rego may deduct agreed commissions, payment fees, refunds, chargebacks, penalties or other authorized amounts from Provider payouts.",
          "Any change to fees will be notified according to the commercial agreement. Already confirmed bookings remain subject to the fee arrangement in effect when confirmed unless otherwise agreed.",
        ],
      },
      {
        heading: "7. Payouts and records",
        body: [
          "Payout timing, reserves, minimum thresholds and supported methods will be shown in the Provider dashboard or commercial schedule.",
          "Rego may delay a payout where reasonably necessary to investigate fraud, chargebacks, traveler complaints, legal restrictions, incorrect bank details or potential Provider liability.",
          "The Provider must retain accurate booking, tax, service and complaint records and provide relevant records for legitimate audits or disputes.",
        ],
      },
      {
        heading: "8. Cancellations, refunds and complaints",
        body: [
          "The Provider must publish clear cancellation terms, apply them consistently and comply with Rego's Cancellation and Refund Policies.",
          "The Provider must respond promptly to complaints and cooperate in investigation. Where the Provider caused a cancellation, non-delivery, material misrepresentation or safety failure, it is responsible for related refunds and reasonable documented costs to the extent permitted by law and contract.",
          "Rego may issue a traveler refund from funds held for the Provider or deduct an approved amount from future payouts.",
        ],
      },
      {
        heading: "9. Reviews and ranking",
        body: [
          "The Provider may invite genuine reviews but must not buy, fabricate, suppress, threaten, condition service on or selectively reward positive reviews.",
          "The Provider may respond professionally. Personal data, threats, discriminatory language and confidential booking details must not be published.",
          "Search position may depend on relevance, availability, quality, traveler engagement, response performance, price, reviews, commercial promotion and other disclosed or legitimate factors.",
        ],
      },
      {
        heading: "10. Data protection and security",
        body: [
          "The Provider must protect traveler information with reasonable security, limit staff access, avoid unauthorized marketing, report suspected data incidents promptly and delete information when no longer lawfully needed.",
          "The Provider must not request full card credentials, passwords, unnecessary identity documents or sensitive information through insecure channels.",
          "Where the Provider processes information on Rego's behalf, additional data-processing terms may apply.",
        ],
      },
      {
        heading: "11. Prohibited conduct",
        body: [
          "The Provider must not offer illegal, unsafe, counterfeit, exploitative or unauthorized services; facilitate corruption or trafficking; discriminate unlawfully; harass travelers; misuse personal data; manipulate payments; or damage Rego's systems or reputation through deception.",
          "Adventure and transport Providers must not operate while staff are impaired or equipment is unsafe.",
        ],
      },
      {
        heading: "12. Insurance and responsibility",
        body: [
          "The Provider must maintain insurance reasonably appropriate to its services and any legally required coverage. On request, evidence must be supplied.",
          "The Provider is responsible for acts and omissions of its owners, staff, drivers, guides, subcontractors and facilities used to fulfill bookings.",
        ],
      },
      {
        heading: "13. Suspension and termination",
        body: [
          "Rego may restrict or remove listings, withhold badges, pause payouts or suspend the Provider for safety risk, fraud, repeated cancellation, serious complaints, expired licenses, non-payment, misleading content or breach.",
          "Immediate action may be taken where delay could harm travelers or the Platform. Where appropriate, Rego will provide reasons and a review opportunity.",
          "Either party may terminate ordinary participation on written notice, but confirmed bookings, payment duties, refunds, confidentiality, data protection, intellectual property and dispute obligations survive as necessary.",
        ],
      },
      {
        heading: "14. Indemnity and liability",
        body: [
          "The Provider will compensate Rego for reasonable claims, refunds, penalties and costs resulting from the Provider's service, breach, unlawful conduct, inaccurate listing, safety failure, tax obligation or infringement, except to the extent caused by Rego.",
          "Nothing excludes liability that cannot lawfully be excluded.",
        ],
      },
      {
        heading: "15. Governing law and contact",
        body: [
          "This Agreement is governed by applicable law in Pakistan and disputes are subject to [COURTS / JURISDICTION], unless the parties agree to another lawful process in writing.",
          "Provider notices: legal@rego.services. Operational support: support@rego.services.",
        ],
      },
    ],
  },
  {
    slug: "reviews",
    title: "Review Policy",
    summary: "The rules for writing, responding to and moderating reviews on Rego.",
    intro: [
      "Rego reviews are intended to help travelers make informed decisions and help Providers improve. Reviews must reflect genuine experiences and comply with this Policy.",
    ],
    sections: [
      {
        heading: "1. Who may review",
        body: [
          "A traveler may review a completed Rego booking or another experience that Rego can reasonably verify.",
          "Rego may label reviews as “Verified booking” where the experience is linked to a completed booking. Verification does not mean Rego agrees with every opinion stated.",
        ],
      },
      {
        heading: "2. What a useful review should contain",
        body: [
          "Reviews should be honest, specific, relevant and based on firsthand experience.",
          "Travelers may discuss service quality, cleanliness, accuracy, communication, value, safety and whether the Provider delivered what was confirmed.",
        ],
      },
      {
        heading: "3. Prohibited review content",
        body: [
          "Fake, purchased, coordinated or competitor reviews; reviews written by owners, staff or close associates without disclosure; and reviews submitted in exchange for money, free service or pressure are prohibited.",
          "Reviews must not contain threats, hate speech, harassment, discrimination, explicit content, unrelated political campaigning, malware, advertising, private addresses, phone numbers, identity documents, payment information or confidential communications.",
          "Allegations of serious criminal or dangerous conduct should be reported to Rego and relevant authorities with evidence rather than published recklessly.",
        ],
      },
      {
        heading: "4. Editing and moderation",
        body: [
          "Rego may use automated and human moderation to detect fraud, abuse, privacy violations and irrelevant content.",
          "Rego may reject, delay, edit only to remove personal data where appropriate, or remove a review that violates this Policy. Rego will not remove a review merely because it is negative.",
          "A review may be temporarily hidden while a credible safety, fraud or authenticity complaint is investigated.",
        ],
      },
      {
        heading: "5. Provider responses",
        body: [
          "Providers may post one professional response, subject to moderation.",
          "Responses must not disclose traveler personal data, threaten legal action merely to silence criticism, offer compensation in exchange for deletion or contain abusive language.",
        ],
      },
      {
        heading: "6. Incentives",
        body: [
          "A Provider may invite all eligible travelers to review and may offer a neutral incentive only where permitted, disclosed and not conditioned on a positive rating.",
          "Rego may run its own transparent review campaigns.",
        ],
      },
      {
        heading: "7. Rating calculation",
        body: [
          "Displayed scores may be rounded and calculated from eligible reviews. Category scores, recent performance or verified bookings may be shown separately.",
          "Rego may exclude fraudulent, duplicate, cancelled or policy-violating reviews from calculations.",
        ],
      },
      {
        heading: "8. Appeals and reporting",
        body: [
          "Travelers and Providers may report a review through the Platform or at support@rego.services, identifying the specific rule allegedly violated.",
          "Disagreement with an opinion is not enough for removal. Rego may request booking records or other evidence before deciding.",
        ],
      },
      {
        heading: "9. Defamation, safety and legal requests",
        body: [
          "Rego will assess properly supported legal notices and may restrict content where required by law or necessary to protect safety and rights.",
          "Submitting a false legal complaint or forged evidence may result in account action.",
        ],
      },
      {
        heading: "10. Review license",
        body: [
          "The reviewer retains ownership but grants Rego the content license described in the Terms and Conditions so the review can be displayed, translated, summarized and promoted in connection with Rego.",
        ],
      },
    ],
  },
  {
    slug: "safety",
    title: "Safety Disclaimer",
    summary: "Important limits and responsibilities for mountain, road and adventure travel.",
    intro: [
      "Travel—especially mountain, road and adventure travel—can involve serious risks. This Disclaimer explains important limits and responsibilities when using Rego.",
    ],
    sections: [
      {
        heading: "1. Travel risk",
        body: [
          "Risks may include altitude illness, extreme weather, avalanche, landslide, flood, rockfall, road accident, mechanical failure, poor communications, remote terrain, wildlife, crime, political restriction, illness, injury, disability and death.",
          "Conditions can change rapidly. A destination or route that was safe earlier may no longer be safe.",
        ],
      },
      {
        heading: "2. Information is not a safety guarantee",
        body: [
          "Rego Map, Rego AI, road reports, weather information, distance estimates, emergency listings, reviews and Provider content are planning tools only.",
          "Information may be third-party, automated, community-submitted, delayed or inaccurate. Always verify critical conditions through official authorities, local administration, police, rescue services, disaster-management agencies and experienced Providers.",
        ],
      },
      {
        heading: "3. Provider responsibility",
        body: [
          "Independent Providers are responsible for the safety and legal compliance of their services, staff, vehicles, facilities, equipment and instructions.",
          "Rego verification is not a guarantee that a Provider will perform safely or that every license, vehicle, guide or item remains current after verification.",
        ],
      },
      {
        heading: "4. Traveler responsibility",
        body: [
          "Travelers must assess personal fitness, skill and experience; obtain medical advice where appropriate; follow instructions; use required equipment; carry identification, medication, water, clothing and emergency supplies; and avoid unnecessary risk.",
          "Do not participate while impaired by alcohol, drugs, exhaustion or a condition that makes the activity unsafe.",
        ],
      },
      {
        heading: "5. Health and altitude",
        body: [
          "Rego does not provide medical advice. Travelers with health concerns, pregnancy, disability or altitude risk should consult a qualified medical professional before travel and disclose essential safety needs to the Provider.",
          "Seek immediate professional assistance for severe symptoms. Do not rely on AI or community content for diagnosis or emergency treatment.",
        ],
      },
      {
        heading: "6. Adventure activities",
        body: [
          "Trekking, mountaineering, climbing, rafting, skiing, safari, camping, off-road driving, fishing and similar activities involve inherent risk even when properly organized.",
          "Travelers should confirm guide qualifications, permits, equipment, evacuation plan, weather limits, group size and insurance before booking.",
        ],
      },
      {
        heading: "7. Roads and transport",
        body: [
          "Road-open labels do not guarantee safe passage. Confirm route status, daylight requirements, vehicle suitability, fuel, driver experience, permits and alternative routes.",
          "Seat belts, helmets and other safety equipment should be used whenever available and required.",
        ],
      },
      {
        heading: "8. Insurance and documents",
        body: [
          "Travelers are strongly encouraged to obtain suitable travel, medical, evacuation, cancellation, baggage and adventure-activity insurance and to review exclusions.",
          "Travelers are responsible for passports, visas, permits, licenses, vaccinations and entry requirements.",
        ],
      },
      {
        heading: "9. Emergencies",
        body: [
          "Rego is not a police, medical, fire, rescue or disaster-response authority. In an emergency, contact the relevant local emergency service and share accurate location information.",
          "Roadside assistance requests depend on network coverage, provider availability, terrain and conditions and are not guaranteed to arrive within a particular time unless expressly confirmed.",
        ],
      },
      {
        heading: "10. Minors and vulnerable travelers",
        body: [
          "A responsible adult must supervise minors and confirm that activities, transport and accommodation are suitable.",
          "Providers and travelers must follow safeguarding requirements and report suspected exploitation or abuse to appropriate authorities.",
        ],
      },
      {
        heading: "11. Limitation",
        body: [
          "Nothing in this Disclaimer removes legal responsibilities that cannot be excluded. It supplements the Terms and does not excuse a Provider or Rego from its own unlawful or negligent conduct where liability is imposed by law.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    summary: "How Rego uses cookies, local storage and similar technologies.",
    intro: [
      "This Cookie Policy explains how Rego uses cookies, pixels, local storage, software development kits and similar technologies on the Platform.",
    ],
    sections: [
      {
        heading: "1. What cookies are",
        body: [
          "Cookies are small files or identifiers stored on or read from a browser or device. They help websites remember sessions, preferences and activity.",
          "Some technologies are placed by Rego and others by service providers such as payment, map, analytics, advertising, social-login or customer-support companies.",
        ],
      },
      {
        heading: "2. Strictly necessary cookies",
        body: [
          "These support sign-in, account security, fraud prevention, booking flow, load balancing, language, cookie choices and other functions required for the Platform to work.",
          "They generally cannot be disabled through the Rego consent tool, although blocking them in the browser may prevent important features from working.",
        ],
      },
      {
        heading: "3. Functional cookies",
        body: [
          "These remember preferences such as language, region, recent searches, map settings and accessibility options.",
          "Disabling them may make the Platform less personalized.",
        ],
      },
      {
        heading: "4. Analytics and performance cookies",
        body: [
          "These help Rego understand visits, navigation, errors, loading speed and feature usage so the Platform can be improved.",
          "Where required, Rego will request consent before placing non-essential analytics technologies.",
        ],
      },
      {
        heading: "5. Advertising and social-media cookies",
        body: [
          "If used, these measure campaigns, limit repeated advertisements, support audience selection and enable social-media features.",
          "They may allow third parties to recognize a browser or device across services. Rego should activate them only after the consent required by applicable law.",
        ],
      },
      {
        heading: "6. Location and application technology",
        body: [
          "The mobile application may use device identifiers, local storage, push-notification tokens and location permissions. These can be controlled through app and device settings.",
          "Precise location should be collected only when the user enables a feature that needs it, such as nearby search, map navigation or roadside assistance.",
        ],
      },
      {
        heading: "7. Your choices",
        body: [
          "Use the Rego cookie banner or privacy settings to accept, reject or adjust non-essential categories.",
          "Browser and device settings can delete or block cookies, limit tracking and revoke location or advertising permissions. Some features may not work correctly after blocking essential storage.",
          "Where available, a “Do Not Sell or Share” or equivalent control will be provided if required by the user's jurisdiction.",
        ],
      },
      {
        heading: "8. Cookie inventory",
        body: [
          "Before publication, Rego must maintain an accurate cookie table naming each cookie or technology, provider, purpose, category and expiry. The live table should be generated from the technologies actually deployed.",
          "Suggested columns: Name; Provider; Purpose; Category; Duration; First-party or third-party.",
        ],
      },
      {
        heading: "9. Retention",
        body: [
          "Session cookies expire when the browser closes. Persistent cookies remain for the period stated in the live cookie inventory unless deleted earlier.",
          "Rego should avoid retaining identifiers longer than necessary for the stated purpose.",
        ],
      },
      {
        heading: "10. Changes and contact",
        body: [
          "This Policy may be updated when technologies or vendors change. The effective date will be revised.",
          "Cookie and privacy questions: privacy@rego.services.",
        ],
      },
    ],
  },
];

/** Static default lookup (built-in text, no database). */
export function getPolicy(slug: string): LegalPolicy | undefined {
  return legalPolicies.find((p) => p.slug === slug);
}

/**
 * Returns all policies: admin-edited content from Supabase where present,
 * otherwise the built-in defaults. Merged by slug against the defaults so the
 * fixed set of nine policies always renders, even if the stored document is
 * older or missing a policy.
 */
export async function getLegalPolicies(): Promise<LegalPolicy[]> {
  if (!isSupabaseConfigured) return legalPolicies;
  try {
    const { data, error } = await supabase
      .from("legal_content")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data?.content) return legalPolicies;
    const stored = data.content as LegalPolicy[];
    const bySlug = new Map(stored.map((p) => [p.slug, p]));
    return legalPolicies.map((def) => bySlug.get(def.slug) ?? def);
  } catch {
    return legalPolicies;
  }
}

/** A single policy with admin overrides applied (falls back to the default). */
export async function getPolicyContent(
  slug: string
): Promise<LegalPolicy | undefined> {
  const all = await getLegalPolicies();
  return all.find((p) => p.slug === slug);
}

/** Upsert the full legal document (admin only, app-gated). */
export async function saveLegalPolicies(policies: LegalPolicy[]) {
  return supabase
    .from("legal_content")
    .upsert({ id: 1, content: policies, updated_at: new Date().toISOString() });
}
