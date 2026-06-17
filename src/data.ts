import { Project, DSREntry } from './types';

export const ADMIN_EMAILS = [
  'vatsalpatel1720@gmail.com',
  'vatsal.assetscout@gmail.com',
  'admin@dsr.com',
  'admin@company.com',
  'shadowff2309@gmail.com'
];

export const DEFAULT_ALLOWED_USERS = [
  'alex.rivera@company.com',
  'employee@company.com',
  'vatsalpatel1720@gmail.com',
  'vatsal.assetscout@gmail.com',
  'admin@dsr.com',
  'admin@company.com',
  'shadowff2309@gmail.com'
];

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: "titan-realestate",
    domain: "titan-realestate.com",
    name: "Titan Real Estate Corporate",
    code: "TITN",
    location: "Mumbai",
    region: "West",
    users: ["shadowff2309@gmail.com", "vatsal.assetscout@gmail.com", "vatsal", "John Doe"],
    description: "Titan core asset monitoring portal"
  },
  {
    id: "aerospace-craft",
    domain: "aerospace-craft.org",
    name: "AeroSpace Craft Logistics",
    code: "AERO",
    location: "Delhi",
    region: "North",
    users: ["shadowff2309@gmail.com", "developer@company.com", "developer", "Jane Smith"],
    description: "Green technology operations"
  },
  {
    id: "clean-energy",
    domain: "clean-energy.net",
    name: "Clean Energy Development",
    code: "CLNR",
    location: "Bengaluru",
    region: "South",
    users: ["shadowff2309@gmail.com", "alex.rivera@company.com", "vatsalpatel1720@gmail.com"],
    description: "Solar deployment management"
  }
];

// Seed some entries conforming to DSREntry with works list!
export const INITIAL_DSR_ENTRIES: DSREntry[] = [
  {
    id: "dsr-init-1",
    date: new Date().toISOString().split('T')[0],
    userEmail: "shadowff2309@gmail.com",
    works: [
      {
        id: "dsr-init-1-0",
        projectId: "titan-realestate",
        projectName: "Titan Real Estate Corporate",
        listingCount: 6,
        blogCount: 3,
        forumCount: 2,
        pdfCount: 4,
        imageCount: 15,
        videoPptCount: 1,
        profileCount: 5,
        linkCount: 22,
        blog: "Published real estate asset blog posts, created high-converting local directory listings, and uploaded property portfolio images. Ensured keyword density matches domain search rules.",
        customValues: {},
        workTypes: ["Listings", "Blogs", "PDF Sharing", "Images", "Links Portfolio", "Social Profiles"],
        contentUpdates: [],
        workSummary: "High-exposure digital asset deployment completed for Titan Real Estate Corporate project."
      }
    ],
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  }
];
