/**
 * About Us content — single source of truth for the whole About section.
 *
 * Kept as one typed object so the copy lives in ONE place and can later be
 * swapped for a Supabase-backed record + admin editor without touching the UI
 * components (they only read from this shape). The founder photo is a single
 * `photo` path: drop a real image at /public/team/founder.jpg (or wire it via
 * admin) and it appears automatically; until then a graceful initials avatar
 * is shown.
 */

export interface AboutContent {
  intro: {
    label: string;
    heading: string;
    paragraphs: string[];
    tagline: string;
    ctas: { label: string; href: string }[];
    floatingCards: string[];
  };
  ceo: {
    sectionTitle: string;
    name: string;
    title: string;
    blocks: { heading: string; paragraphs: string[] }[];
    signature: { name: string; lines: string[] };
    achievement: { label: string; description: string };
  };
  founder: {
    photo: string; // e.g. "/team/founder.jpg"
    name: string;
    position: string;
    background: string;
    education: string;
    hometown: string;
    role: string;
    badge: string;
  };
  highlights: { key: string; title: string; description: string }[];
  mission: { label: string; heading: string; body: string };
  vision: { label: string; heading: string; body: string };
  values: { key: string; title: string; description: string }[];
  ecosystem: {
    label: string;
    heading: string;
    description: string;
    services: {
      key: string;
      name: string;
      status: "active" | "soon";
      statusLabel: string;
      description: string;
      href?: string;
    }[];
  };
  banner: {
    heading: string;
    description: string;
    ctas: { label: string; href: string }[];
  };
}

export const aboutContent: AboutContent = {
  intro: {
    label: "About Rego",
    heading:
      "Connecting Gilgit-Baltistan Through Tourism, Technology and Digital Services",
    paragraphs: [
      "Rego is a complete digital tourism marketplace designed to connect travelers with trusted hotels, tour operators, tour guides, transport providers, rental services, local activities and other essential tourism businesses across Gilgit-Baltistan.",
      "The platform makes travel discovery, planning and communication easier while helping local businesses build their digital presence and connect directly with customers from Pakistan and around the world.",
      "Rego is starting with tourism, but its long-term vision is much bigger: to create a connected digital ecosystem for Gilgit-Baltistan through mobility, delivery, local commerce and other essential digital services.",
    ],
    tagline: "Book • Explore • Experience",
    ctas: [
      { label: "Explore Rego", href: "/listings" },
      { label: "Discover Our Services", href: "/categories/hotels" },
    ],
    floatingCards: [
      "Complete Tourism Marketplace",
      "Local Businesses Connected",
      "Built for Gilgit-Baltistan",
      "One Trusted Platform",
    ],
  },
  ceo: {
    sectionTitle: "Message from the CEO & Founder",
    name: "Mr. Shabbir Hussain",
    title: "CEO & Founder | Software Engineer | Developer of Rego",
    blocks: [
      {
        heading: "Introduction",
        paragraphs: [
          "Rego was founded with a vision to digitally transform tourism, local businesses and everyday services across Gilgit-Baltistan. The idea behind Rego is to create a trusted digital platform that connects travelers, residents, businesses and service providers through modern technology.",
          "Gilgit-Baltistan has enormous tourism and business potential. However, many local businesses and essential services still have limited access to organised digital platforms. Rego has been developed to help bridge this gap by making services easier to discover, access and manage online.",
        ],
      },
      {
        heading: "Personal Background",
        paragraphs: [
          "I am originally from Hardass, Roundu, Gilgit-Baltistan. Growing up in the region gave me a close understanding of its natural beauty, tourism potential, local communities and the challenges people face because of limited access to organised digital services.",
          "Inspired by local challenges and the strong potential for digital growth across Gilgit-Baltistan, I decided to create a platform that could solve practical problems while supporting travelers, local businesses, entrepreneurs and communities.",
        ],
      },
      {
        heading: "Education and Development Journey",
        paragraphs: [
          "I completed my degree in Software Engineering from COMSATS University Islamabad, Abbottabad Campus. My education and professional background in software engineering provided me with the technical knowledge required to transform the Rego concept into a functional web-based application.",
          "The complete Rego web-based application has been personally planned, designed and developed by me. This includes the customer-facing platform, service-provider dashboards, admin management system, database architecture, user authentication, booking functionality, business listings, analytics, communication tools and other essential platform features.",
          "Rego is beginning as a complete digital tourism marketplace where travelers can discover destinations, compare tourism services and connect directly with hotels, tour operators, guides, transport providers, rental businesses, activity providers and other local tourism services.",
        ],
      },
      {
        heading: "Future Vision",
        paragraphs: [
          "My vision for Rego extends beyond tourism. Our future plan is to develop Rego into a complete digital ecosystem for Gilgit-Baltistan through Rego Ride, Rego Delivery and Rego Buy & Sell.",
          "These future services will help improve access to transportation, local delivery and digital commerce while creating new opportunities for drivers, businesses, entrepreneurs and communities throughout Gilgit-Baltistan.",
          "The long-term goal is to contribute to the digital transformation of Gilgit-Baltistan by connecting tourism, mobility, delivery, commerce and other essential services through one trusted platform.",
          "Through Rego, I aim to support local entrepreneurs, create employment opportunities, improve access to services and help connect Gilgit-Baltistan with the wider digital world.",
          "Rego is not only a web-based application. It represents a vision for a smarter, more connected and digitally empowered Gilgit-Baltistan.",
        ],
      },
    ],
    signature: {
      name: "Shabbir Hussain",
      lines: [
        "CEO & Founder, Rego",
        "Software Engineer",
        "Hardass, Roundu, Gilgit-Baltistan",
      ],
    },
    achievement: {
      label: "Built from the ground up",
      description:
        "The complete Rego web-based application was personally planned, designed and developed by Mr. Shabbir Hussain.",
    },
  },
  founder: {
    photo: "/team/founder.jpg.webp",
    name: "Mr. Shabbir Hussain",
    position: "CEO & Founder",
    background: "Software Engineer",
    education:
      "Software Engineering — COMSATS University Islamabad, Abbottabad Campus",
    hometown: "Hardass, Roundu, Gilgit-Baltistan",
    role: "Founder, Lead Developer and Platform Architect",
    badge: "Founder & Developer of Rego",
  },
  highlights: [
    {
      key: "engineer",
      title: "Software Engineer",
      description:
        "Educated in Software Engineering at COMSATS University Islamabad, Abbottabad Campus.",
    },
    {
      key: "built",
      title: "Built Rego From the Ground Up",
      description:
        "Personally planned, designed and developed the complete Rego web-based application.",
    },
    {
      key: "gb",
      title: "From Gilgit-Baltistan",
      description:
        "Originally from Hardass, Roundu, with a strong understanding of the region's local needs and opportunities.",
    },
    {
      key: "vision",
      title: "Vision for Digital GB",
      description:
        "Inspired by local challenges and the strong potential for digital growth across Gilgit-Baltistan.",
    },
  ],
  mission: {
    label: "Our Mission",
    heading: "Connecting People, Businesses and Services Through Technology",
    body: "Our mission is to build a trusted and accessible digital ecosystem that connects travelers, residents and local businesses with tourism, transportation, delivery, commerce and other essential services. Through Rego, we aim to simplify access to services, support local entrepreneurs, create new digital opportunities and contribute to sustainable economic growth throughout Gilgit-Baltistan.",
  },
  vision: {
    label: "Our Vision",
    heading: "A Smarter and Digitally Connected Gilgit-Baltistan",
    body: "Our vision is to digitally transform Gilgit-Baltistan by creating one connected platform for tourism, mobility, delivery, local commerce and essential services. We aspire to make the region more accessible, digitally empowered and globally connected while preserving its culture, supporting its communities and promoting its unique identity to the world.",
  },
  values: [
    {
      key: "trust",
      title: "Trust & Transparency",
      description:
        "Building a reliable platform through verified information, clear communication and responsible digital practices.",
    },
    {
      key: "local",
      title: "Local Empowerment",
      description:
        "Helping local businesses, service providers, entrepreneurs and communities grow through digital access and modern technology.",
    },
    {
      key: "ux",
      title: "User-Centered Experience",
      description:
        "Creating simple, accessible and practical digital experiences for travelers, residents and businesses.",
    },
    {
      key: "innovation",
      title: "Innovation Through Technology",
      description:
        "Using modern software and technology to solve local challenges and improve access to essential services.",
    },
  ],
  ecosystem: {
    label: "The Rego Ecosystem",
    heading: "One Platform. Multiple Services. One Digital Gilgit-Baltistan.",
    description:
      "Rego is starting with tourism, but our long-term goal is to create a complete digital services ecosystem for Gilgit-Baltistan. Each Rego service will address a local need, improve accessibility and create new opportunities for individuals, service providers and businesses.",
    services: [
      {
        key: "tourism",
        name: "Rego Tourism",
        status: "active",
        statusLabel: "Launching First",
        description:
          "A complete digital tourism marketplace connecting travelers with hotels, tour operators, guides, transport providers, rental services, activities, local experiences and other tourism-related businesses.",
        href: "/listings",
      },
      {
        key: "ride",
        name: "Rego Ride",
        status: "soon",
        statusLabel: "Coming Soon",
        description:
          "A local mobility and ride-booking platform designed to connect passengers with trusted drivers across the cities, valleys and tourist destinations of Gilgit-Baltistan.",
      },
      {
        key: "delivery",
        name: "Rego Delivery",
        status: "soon",
        statusLabel: "Coming Soon",
        description:
          "A reliable local delivery platform for food, groceries, medicines, parcels and business products, helping customers access essential items while enabling local businesses to serve wider areas.",
      },
      {
        key: "buysell",
        name: "Rego Buy & Sell",
        status: "soon",
        statusLabel: "Coming Soon",
        description:
          "A trusted digital marketplace where individuals and businesses can buy, sell and discover products, properties, vehicles, equipment and locally available goods across Gilgit-Baltistan.",
      },
    ],
  },
  banner: {
    heading: "Building a Digital Gilgit-Baltistan",
    description:
      "Our goal is to connect tourism, transportation, delivery, commerce and local services through one trusted digital ecosystem. By bringing businesses and communities online, Rego aims to support entrepreneurs, create employment opportunities, improve access to services and contribute to a smarter and more connected Gilgit-Baltistan.",
    ctas: [
      { label: "Explore Rego", href: "/listings" },
      { label: "Join the Rego Ecosystem", href: "/partner" },
    ],
  },
};
