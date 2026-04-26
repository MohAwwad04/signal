/**
 * Full demo seed — clears the DB then populates it with:
 *   2 superadmins · 4 admins · 5-10 users per admin
 *   frameworks · content angles · signals
 *
 * Run: npx tsx scripts/seed-demo.ts
 *
 * NOTE: Superadmins are stored as role='admin' in the DB.
 *       For true superadmin access, add their emails to the ALLOWED_EMAILS env var.
 */

import { db, schema } from "../lib/db";
import { hashPassword } from "../lib/password";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────
// Credential definitions
// ─────────────────────────────────────────────────────────────────

const SUPERADMINS = [
  { email: "superadmin1@signal.app", password: "Signal@SA1" },
  { email: "superadmin2@signal.app", password: "Signal@SA2" },
];

type AdminDef = {
  email: string;
  password: string;
  name: string;
  role: string;
  bio: string;
  voiceProfile: string;
  styleNotes: string;
  contentAngles: string[];
  users: { email: string; password: string; name: string; role: string; bio: string; contentAngles: string[] }[];
};

const TEAM: AdminDef[] = [
  {
    email: "sarah.chen@signal.app",
    password: "Admin@Sarah1",
    name: "Sarah Chen",
    role: "CEO",
    bio: "Former engineer turned CEO. Writes about scaling teams, decision-making under uncertainty, and what no one tells you about going from product to people.",
    voiceProfile:
      "- Uses short, punchy sentences under 12 words\n- Opens with a counterintuitive claim, never a question\n- Names specific decisions rather than abstract lessons\n- Avoids corporate speak: no 'leverage', 'synergy', 'impactful'\n- Ends with a direct call to examine your own assumptions",
    styleNotes: "Confident, direct, slightly provocative. Reads like a founder talking to a peer, not an audience.",
    contentAngles: ["Founder Lessons", "Leadership Development", "Team Building", "Hiring & Culture"],
    users: [
      { email: "alice.morgan@signal.app",   password: "Pass@001", name: "Alice Morgan",   role: "VP Engineering",   bio: "Leads a 40-person engineering org. Writes about technical leadership and hiring.",    contentAngles: ["Engineering Culture", "Hiring & Culture", "Team Building"] },
      { email: "brian.torres@signal.app",   password: "Pass@002", name: "Brian Torres",   role: "Head of Design",   bio: "Product designer turned design lead. Writes about design systems and craft.",          contentAngles: ["Product Leadership", "Team Building"] },
      { email: "claire.wu@signal.app",      password: "Pass@003", name: "Claire Wu",      role: "CFO",              bio: "Operator and finance lead. Writes about unit economics and startup discipline.",       contentAngles: ["Revenue Growth", "Data-Driven Decisions", "Startup Operations"] },
      { email: "david.osei@signal.app",     password: "Pass@004", name: "David Osei",     role: "COO",              bio: "Scaled operations from 5 to 150 people. Writes about execution and process.",         contentAngles: ["Startup Operations", "Team Building", "Leadership Development"] },
      { email: "emma.blake@signal.app",     password: "Pass@005", name: "Emma Blake",     role: "Chief of Staff",   bio: "Runs cross-functional initiatives. Writes about alignment and stakeholder communication.", contentAngles: ["Leadership Development", "Remote Work"] },
      { email: "felix.schmidt@signal.app",  password: "Pass@006", name: "Felix Schmidt",  role: "Head of People",   bio: "People lead focused on culture and retention. Writes about what actually makes teams work.", contentAngles: ["Hiring & Culture", "Team Building", "Remote Work"] },
    ],
  },
  {
    email: "marcus.rivera@signal.app",
    password: "Admin@Marcus2",
    name: "Marcus Rivera",
    role: "Head of Sales",
    bio: "Carried a bag for 8 years, now leads a sales org. Writes about what actually closes deals versus what gets taught in sales training.",
    voiceProfile:
      "- Leads with a specific number or dollar figure\n- Uses 'I' not 'we' — personal accountability tone\n- Breaks conventional sales advice explicitly before offering the alternative\n- Short paragraphs, one idea per line\n- Closes with a concrete action the reader can take today",
    styleNotes: "Practical, numbers-first, anti-fluff. Sounds like advice from a senior rep, not a motivational speaker.",
    contentAngles: ["B2B Sales Strategy", "Revenue Growth", "Customer Success"],
    users: [
      { email: "grace.kim@signal.app",    password: "Pass@007", name: "Grace Kim",    role: "Account Executive",     bio: "Mid-market AE. Writes about deal mechanics and objection handling.",                      contentAngles: ["B2B Sales Strategy", "Customer Success"] },
      { email: "henry.patel@signal.app",  password: "Pass@008", name: "Henry Patel",  role: "SDR Manager",           bio: "Runs an SDR team of 12. Writes about pipeline generation and prospecting.",              contentAngles: ["B2B Sales Strategy", "Revenue Growth"] },
      { email: "iris.johnson@signal.app", password: "Pass@009", name: "Iris Johnson", role: "Sales Enablement Lead",  bio: "Trains reps on messaging and process. Writes about what actually moves win rates.",      contentAngles: ["B2B Sales Strategy", "Leadership Development"] },
      { email: "jack.nguyen@signal.app",  password: "Pass@010", name: "Jack Nguyen",  role: "VP Customer Success",   bio: "Owns the post-sale relationship. Writes about churn prevention and expansion.",           contentAngles: ["Customer Success", "Revenue Growth"] },
      { email: "kate.miller@signal.app",  password: "Pass@011", name: "Kate Miller",  role: "Revenue Operations",    bio: "RevOps lead. Writes about data integrity, forecasting, and sales process design.",        contentAngles: ["Revenue Growth", "Data-Driven Decisions", "B2B Sales Strategy"] },
      { email: "liam.davis@signal.app",   password: "Pass@012", name: "Liam Davis",   role: "Enterprise AE",         bio: "Closes 7-figure deals. Writes about navigating complex enterprise buying committees.",    contentAngles: ["B2B Sales Strategy", "Customer Success"] },
      { email: "maya.wilson@signal.app",  password: "Pass@013", name: "Maya Wilson",  role: "Partnerships Lead",     bio: "Builds channel and alliance programs. Writes about partner-led growth.",                 contentAngles: ["Revenue Growth", "B2B Sales Strategy", "Go-to-Market"] },
    ],
  },
  {
    email: "lena.hoffmann@signal.app",
    password: "Admin@Lena3",
    name: "Lena Hoffmann",
    role: "Product Lead",
    bio: "Product leader who has shipped zero-to-one products at two different companies. Writes about prioritisation, discovery, and the unglamorous work of actually shipping.",
    voiceProfile:
      "- Opens with a tension or contradiction, not a question\n- Uses specific product examples (real feature names, real metrics)\n- Challenges common PM frameworks by name\n- Writes in short declarative sentences, never passive voice\n- Ends with a single actionable question for the reader to apply",
    styleNotes: "Sharp, opinionated, practitioner-first. No theory without a real example attached.",
    contentAngles: ["Product Leadership", "Data-Driven Decisions", "Go-to-Market"],
    users: [
      { email: "noah.anderson@signal.app",  password: "Pass@014", name: "Noah Anderson",  role: "Senior PM",            bio: "Owns core product. Writes about discovery, scoping, and shipping with constraints.",     contentAngles: ["Product Leadership", "Data-Driven Decisions"] },
      { email: "olivia.martin@signal.app",  password: "Pass@015", name: "Olivia Martin",  role: "UX Researcher",        bio: "Runs user research. Writes about turning insight into action without losing nuance.",    contentAngles: ["Product Leadership", "Customer Success"] },
      { email: "peter.clark@signal.app",    password: "Pass@016", name: "Peter Clark",    role: "Data Analyst",         bio: "Product analytics. Writes about metrics that matter and the ones teams misread.",        contentAngles: ["Data-Driven Decisions", "Product Leadership"] },
      { email: "quinn.taylor@signal.app",   password: "Pass@017", name: "Quinn Taylor",   role: "Growth PM",            bio: "Runs growth experiments. Writes about A/B testing, funnels, and what actually lifts.",  contentAngles: ["Go-to-Market", "Data-Driven Decisions", "Revenue Growth"] },
      { email: "rachel.white@signal.app",   password: "Pass@018", name: "Rachel White",   role: "Product Designer",     bio: "Designs for conversion. Writes about the gap between beautiful and functional.",        contentAngles: ["Product Leadership", "Go-to-Market"] },
    ],
  },
  {
    email: "omar.khalid@signal.app",
    password: "Admin@Omar4",
    name: "Omar Khalid",
    role: "Founder",
    bio: "Built and sold a B2B SaaS in 4 years. Now building again. Writes honestly about what the second time around actually looks like versus the first.",
    voiceProfile:
      "- Always opens with a specific moment, not a general claim\n- Uses 'I made this mistake' framing rather than 'here's what you should do'\n- Anchors every lesson in a real number or real date\n- Short paragraphs. Never more than 3 sentences before a line break\n- Writes like someone who has already made the mistake and is 3 years past it",
    styleNotes: "Honest, specific, non-preachy. The kind of post that makes you feel like the author earned the lesson.",
    contentAngles: ["Founder Lessons", "Startup Operations", "Revenue Growth", "Hiring & Culture"],
    users: [
      { email: "sam.brown@signal.app",    password: "Pass@019", name: "Sam Brown",    role: "CTO",                  bio: "Technical co-founder. Writes about building engineering culture from scratch.",         contentAngles: ["Engineering Culture", "Startup Operations", "Hiring & Culture"] },
      { email: "tina.garcia@signal.app",  password: "Pass@020", name: "Tina Garcia",  role: "Head of Marketing",    bio: "B2B marketer. Writes about positioning, messaging, and content that actually converts.",  contentAngles: ["Marketing Strategy", "Go-to-Market", "B2B Sales Strategy"] },
      { email: "umar.ali@signal.app",     password: "Pass@021", name: "Umar Ali",     role: "Finance Lead",         bio: "First finance hire. Writes about fundraising, runway, and financial storytelling.",       contentAngles: ["Startup Operations", "Revenue Growth", "Data-Driven Decisions"] },
      { email: "vera.jones@signal.app",   password: "Pass@022", name: "Vera Jones",   role: "Head of Operations",   bio: "Runs ops and systems. Writes about the boring work that makes fast companies fast.",      contentAngles: ["Startup Operations", "Leadership Development"] },
      { email: "will.thomas@signal.app",  password: "Pass@023", name: "Will Thomas",  role: "Sales Lead",           bio: "First sales hire. Writes about founder-led sales and the first 10 customers.",           contentAngles: ["B2B Sales Strategy", "Founder Lessons", "Go-to-Market"] },
      { email: "xena.lee@signal.app",     password: "Pass@024", name: "Xena Lee",     role: "Customer Success Lead", bio: "Owns onboarding and retention. Writes about making customers successful before they ask.", contentAngles: ["Customer Success", "Startup Operations"] },
      { email: "yusuf.hassan@signal.app", password: "Pass@025", name: "Yusuf Hassan", role: "Product Manager",      bio: "Sole PM at an early-stage startup. Writes about doing product with no process yet.",       contentAngles: ["Product Leadership", "Startup Operations", "Founder Lessons"] },
      { email: "zara.ahmed@signal.app",   password: "Pass@026", name: "Zara Ahmed",   role: "Brand & Comms Lead",   bio: "Shapes narrative and brand. Writes about positioning, story, and category design.",      contentAngles: ["Marketing Strategy", "Go-to-Market", "Founder Lessons"] },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// Framework definitions
// ─────────────────────────────────────────────────────────────────

const FRAMEWORKS = [
  {
    name: "Hook · Story · Lesson",
    description: "Strong opening, one specific story, one takeaway. The default LinkedIn format.",
    promptTemplate:
      "Structure: (1) One-line hook that creates curiosity or tension. (2) A 3-5 line story with a specific moment, number, or quote. (3) One line that names the lesson — no moralizing. (4) One line that invites a response.",
    bestFor: ["customer_quote", "buying_signal", "technical_insight", "lesson"],
  },
  {
    name: "Before · After · Bridge",
    description: "A specific change: what it was, what it is, what moved it.",
    promptTemplate:
      "Structure: (1) Describe the 'before' state in concrete terms — a number, a pain, a moment. (2) The 'after' state — equally concrete. (3) The 'bridge' — the one specific thing that changed it. No abstractions. No 'the rest is history.'",
    bestFor: ["success_metric", "before_after"],
  },
  {
    name: "Counter-take",
    description: "A short, confident take that goes against common wisdom.",
    promptTemplate:
      "Structure: (1) State the common wisdom most people repeat. (2) Say why it's wrong — use a specific example or number. (3) Offer a better rule. Keep it under 140 words. Sharp, not preachy.",
    bestFor: ["technical_insight", "objection"],
  },
  {
    name: "Data drop",
    description: "Lead with a single striking number, then unpack it.",
    promptTemplate:
      "Structure: (1) The number — on its own line. (2) What it means — one line. (3) Why it matters — 2-3 lines with a concrete example. (4) What it implies. No throat-clearing.",
    bestFor: ["success_metric"],
  },
  {
    name: "Quote carousel",
    description: "A real quote from a customer or meeting, framed honestly.",
    promptTemplate:
      "Structure: (1) Set the scene in one line — who, when, context. (2) The quote itself, indented. (3) Your 2-sentence reflection on why it stuck with you. Do NOT add a CTA. Let the quote carry it.",
    bestFor: ["customer_quote", "paying_quote"],
  },
  {
    name: "5-Why Breakdown",
    description: "Peel back a surprising outcome by asking why five times.",
    promptTemplate:
      "Structure: (1) State the outcome — specific and surprising. (2) Ask 'why?' and answer it. (3) Ask 'why?' again, go deeper. (4) Continue until you hit the root cause (3-5 levels). (5) Name the real lesson the chain reveals. Each why must add new information, not restate the previous.",
    bestFor: ["lesson", "mistake", "root_cause"],
  },
  {
    name: "List + Lesson",
    description: "3-5 numbered items each with one concrete detail, closed by a single unifying principle.",
    promptTemplate:
      "Structure: (1) One-line setup that promises a specific number of items. (2) Items — numbered, each on its own line, each with one concrete detail or example (no vague bullets). (3) One closing sentence that names the principle connecting all items. No 'in conclusion'. No 'I hope this helps'.",
    bestFor: ["process", "framework", "tips"],
  },
];

// ─────────────────────────────────────────────────────────────────
// Content angle definitions
// ─────────────────────────────────────────────────────────────────

const CONTENT_ANGLE_NAMES = [
  "B2B Sales Strategy",
  "Founder Lessons",
  "Product Leadership",
  "Engineering Culture",
  "Team Building",
  "Revenue Growth",
  "Customer Success",
  "Hiring & Culture",
  "Remote Work",
  "Startup Operations",
  "Marketing Strategy",
  "Leadership Development",
  "Data-Driven Decisions",
  "Go-to-Market",
];

// ─────────────────────────────────────────────────────────────────
// Signal definitions (inserted after authors/frameworks exist)
// ─────────────────────────────────────────────────────────────────

// Defined as a function so we can reference author/framework IDs at runtime
function buildSignals(
  authorByRole: Record<string, number>,
  fwByName: Record<string, number>,
) {
  return [
    // ── CEO / Leadership ──
    {
      title: "We stopped hiring for culture fit — here's what changed",
      rawContent:
        "We used to reject candidates who felt 'off' without being able to explain why. That instinct cost us 3 strong hires in one quarter. When we audited those decisions, the pattern was clear: 'culture fit' meant 'similar to us'. We replaced it with a concrete rubric — can they disagree productively, do they have a track record of shipping under pressure, do they leave systems better than they found them. Hiring quality went up 40% by our own post-hire scoring. The lesson: vague values are a bias machine. Make them operational or drop them.",
      hashtags: ["hiring", "leadership", "startups"],
      contentAngles: ["Hiring & Culture", "Leadership Development"],
      authorRole: "CEO",
      frameworkName: "Before · After · Bridge",
      scores: { hook: 72, specificity: 68, clarity: 81, emotional: 55, cta: 60 },
    },
    {
      title: "The decision that saved us 6 months of engineering time",
      rawContent:
        "In Q2 we were about to rebuild our data pipeline from scratch. The estimate was 14 weeks. Before greenlighting it, I asked the team one question: what breaks if we don't do this? Nobody could give a concrete answer tied to a customer complaint or a revenue number. We killed it. Three months later, a customer asked for the exact feature the rebuild would have enabled — but by then we had enough signal to scope it in 3 weeks instead of 14. The discipline of 'what breaks if we don't?' has saved us more than any prioritization framework.",
      hashtags: ["productmanagement", "engineering", "decisionmaking"],
      contentAngles: ["Founder Lessons", "Startup Operations"],
      authorRole: "CEO",
      frameworkName: "Hook · Story · Lesson",
      scores: { hook: 65, specificity: 74, clarity: 78, emotional: 58, cta: 52 },
    },
    // ── Head of Sales ──
    {
      title: "Why our best quarter came after cutting the team by 2",
      rawContent:
        "Q3 revenue was up 31% over Q2. We had 2 fewer reps on the floor. Not because we worked harder — we stopped accepting pipeline that didn't fit our ICP. The bottom two reps were closing deals that churned within 90 days, inflating bookings while destroying NRR. Removing that drag forced the remaining team to be selective. Average deal size went from $18k to $27k. Churn dropped from 14% to 6% annualised. The right customers close faster, complain less, and expand more. Headcount is not a substitute for ICP discipline.",
      hashtags: ["sales", "revenuegrowth", "b2bsales"],
      contentAngles: ["B2B Sales Strategy", "Revenue Growth"],
      authorRole: "Head of Sales",
      frameworkName: "Data drop",
      scores: { hook: 78, specificity: 85, clarity: 80, emotional: 62, cta: 65 },
    },
    {
      title: "The objection that was actually a buying signal",
      rawContent:
        "A prospect told us our pricing was 'too high' on call 3. We'd heard it before and usually dropped price. This time we asked instead: 'compared to what outcome?' Silence. Then: 'honestly, we haven't modelled the cost of not solving this'. That one question unlocked a 6-month deal at full price, closed in 11 days. The objection wasn't about price — it was about uncertainty. Prospects who push back hard are often closer to yes than the quiet ones. The push is how they process risk, not how they signal rejection.",
      hashtags: ["b2bsales", "salesstrategy", "negotiation"],
      contentAngles: ["B2B Sales Strategy", "Customer Success"],
      authorRole: "Head of Sales",
      frameworkName: "Quote carousel",
      scores: { hook: 70, specificity: 72, clarity: 77, emotional: 68, cta: 58 },
    },
    // ── Product Lead ──
    {
      title: "We shipped a feature 80% of users asked for. 3% used it.",
      rawContent:
        "After our last roadmap review, we prioritised a bulk export feature because 80% of surveyed users said they wanted it. Within 30 days of launch, 3% had used it. We went back to the users who'd requested it — turns out 'wanting a feature' and 'the feature solving my actual problem' are different things. What they wanted was a faster way to share results with their manager. Bulk export was one hypothesis. A one-click PDF summary would have been another. Now we don't ask 'do you want X?' — we ask 'walk me through the last time you needed to do Y'.",
      hashtags: ["productmanagement", "userresearch", "productdevelopment"],
      contentAngles: ["Product Leadership", "Data-Driven Decisions"],
      authorRole: "Product Lead",
      frameworkName: "Before · After · Bridge",
      scores: { hook: 82, specificity: 79, clarity: 83, emotional: 70, cta: 67 },
    },
    {
      title: "Roadmap prioritisation was killing our retention",
      rawContent:
        "For 18 months we ran a standard priority matrix: impact vs effort, scored by PMs. Our retention at month 3 was stuck at 38%. When we pulled the data on what churned customers had in common, none of it appeared in our priority matrix. They'd never completed onboarding step 5. That one step — connecting their first integration — predicted 70% of 6-month retention. We hadn't prioritised fixing it because it scored low on 'impact'. We were measuring impact by feature usage, not by what made people stay. Now retention metrics sit at the top of every scoring rubric, not the bottom.",
      hashtags: ["productmanagement", "retention", "saas"],
      contentAngles: ["Product Leadership", "Data-Driven Decisions", "Revenue Growth"],
      authorRole: "Product Lead",
      frameworkName: "5-Why Breakdown",
      scores: { hook: 75, specificity: 82, clarity: 80, emotional: 65, cta: 62 },
    },
    // ── Founder ──
    {
      title: "I almost fired my best hire because I didn't understand their communication style",
      rawContent:
        "Six months in, my CTO barely spoke in leadership meetings. I read it as disengagement. I started preparing a 'we need to talk' conversation. Before I had it, I asked a mutual colleague what they thought. Their take: 'He processes by writing, not talking. Check his Slack.' I did. His channel was full of the most incisive thinking on our product I'd seen. I'd almost lost him because I measured engagement by how much someone spoke in rooms. Since then every person I hire, I ask upfront: how do you think best? Listening to the answer has saved me from three more of the same mistake.",
      hashtags: ["leadership", "founders", "teambuilding"],
      contentAngles: ["Founder Lessons", "Hiring & Culture"],
      authorRole: "Founder",
      frameworkName: "Hook · Story · Lesson",
      scores: { hook: 85, specificity: 80, clarity: 84, emotional: 78, cta: 70 },
    },
    {
      title: "Our first profitable month came 8 months after we stopped chasing growth",
      rawContent:
        "We burned $340k in 18 months trying to hit a user growth target that our investors wanted. Month 19, we stopped running growth spend entirely — not strategically, we ran out of budget. That month, we went from $14k MRR to $22k. Without the noise of paid acquisition, we could finally see which organic channels were working. It turned out our founder-led content was generating 60% of signups at zero cost. We'd been drowning it out with paid campaigns. Profitability didn't come from scaling — it came from stopping long enough to see what was already working.",
      hashtags: ["founders", "startups", "bootstrapping"],
      contentAngles: ["Founder Lessons", "Revenue Growth", "Startup Operations"],
      authorRole: "Founder",
      frameworkName: "Before · After · Bridge",
      scores: { hook: 80, specificity: 87, clarity: 82, emotional: 72, cta: 68 },
    },
    // ── VP Engineering ──
    {
      title: "On-call rotation destroyed our engineering culture — until we changed one rule",
      rawContent:
        "For 18 months, our on-call rotation was a 24/7 burden shared equally across the team. Senior engineers were waking up at 3am to fix issues caused by code they hadn't touched in a year. Junior engineers were paralysed with anxiety about holding the pager. Morale was at its lowest when we made one change: you own what you ship. If your service pages, you're on the hook — regardless of seniority. Within 2 months, incident volume dropped 40% and mean time to resolve halved. Engineers started caring about observability, runbooks, and rollback procedures because the cost of ignoring them became personal.",
      hashtags: ["engineering", "devops", "engineeringculture"],
      contentAngles: ["Engineering Culture", "Leadership Development"],
      authorRole: "VP Engineering",
      frameworkName: "Before · After · Bridge",
      scores: { hook: 74, specificity: 81, clarity: 79, emotional: 67, cta: 60 },
    },
    // ── Head of Marketing ──
    {
      title: "We spent $80k on a rebrand. Our best content was already free.",
      rawContent:
        "After a $80k rebrand — new logo, new color system, new positioning doc — our inbound pipeline didn't move. Then our founder posted a 400-word thread about a mistake we made in year one. It got 280k impressions in 4 days and drove 90 leads. The rebrand changed how we looked. The founder's post changed what people believed about us. Visual identity is not a substitute for a point of view. The highest-ROI brand investment we've made is helping our leadership team publish what they actually think.",
      hashtags: ["marketing", "contentmarketing", "b2bmarketing"],
      contentAngles: ["Marketing Strategy", "Go-to-Market", "Founder Lessons"],
      authorRole: "Head of Marketing",
      frameworkName: "Data drop",
      scores: { hook: 83, specificity: 85, clarity: 81, emotional: 73, cta: 72 },
    },
    // ── Enterprise AE ──
    {
      title: "The buying committee member nobody talks to is often the one who kills the deal",
      rawContent:
        "I lost a $400k deal in the final week because someone in IT security flagged a compliance question I hadn't addressed. I'd spent 4 months selling to the economic buyer and two champions. I'd never mapped the full buying committee. After that deal died, I started asking in every discovery call: 'Who else will be part of the evaluation — including people who can say no but not yes?' That one question has surfaced blockers in 7 of my last 9 deals early enough to address them. Multi-stakeholder deals don't die at the end — they die early when you don't know who's in the room.",
      hashtags: ["enterprisesales", "b2bsales", "dealmanagement"],
      contentAngles: ["B2B Sales Strategy", "Customer Success"],
      authorRole: "Enterprise AE",
      frameworkName: "Hook · Story · Lesson",
      scores: { hook: 77, specificity: 83, clarity: 80, emotional: 65, cta: 70 },
    },
    // ── Senior PM ──
    {
      title: "Discovery interviews were giving us false confidence — here's what we changed",
      rawContent:
        "We were running 30-minute discovery calls, feeling great about our insights, and shipping features that landed flat. When we recorded and reviewed 20 of those calls, the problem was obvious: we were asking leading questions. 'Would it be useful if you could export this in bulk?' is not discovery — it's confirmation. We rewrote our entire interview guide around one principle: only ask about past behaviour, never hypothetical preferences. 'Tell me about the last time you had to get data out of this system — what did you do?' That shift cut our misfire rate on new features from roughly 60% to under 20% over the following two quarters.",
      hashtags: ["productmanagement", "userresearch", "discovery"],
      contentAngles: ["Product Leadership", "Data-Driven Decisions"],
      authorRole: "Senior PM",
      frameworkName: "Counter-take",
      scores: { hook: 76, specificity: 80, clarity: 82, emotional: 62, cta: 66 },
    },
    // ── CTO (Founder's team) ──
    {
      title: "Hiring senior engineers too early nearly killed our culture",
      rawContent:
        "At 8 engineers, we hired 3 senior ICs from big tech — each earning more than anyone else on the team. Within 90 days, collaboration dropped and decision-making slowed. The problem wasn't their skills. It was that they came with processes designed for 200-person engineering orgs. They added layers of review and coordination that made sense at scale but created drag at ours. We should have been explicit at hire: we value people who simplify, not people who bring the systems from their last job. Two of those three eventually thrived after we had that conversation. One left. Now I ask directly in the loop: 'What will you need to do your best work here?'",
      hashtags: ["engineering", "startuplife", "hiring"],
      contentAngles: ["Engineering Culture", "Startup Operations", "Hiring & Culture"],
      authorRole: "CTO",
      frameworkName: "Hook · Story · Lesson",
      scores: { hook: 79, specificity: 76, clarity: 78, emotional: 69, cta: 64 },
    },
    // ── Revenue Operations ──
    {
      title: "Our CRM had 3 years of data. We were ignoring 80% of it.",
      rawContent:
        "When we ran our first proper win/loss analysis, we found that deals touching more than 3 stakeholders closed at 2.3x the rate of single-stakeholder deals — and at 1.8x higher ACV. That data was in our CRM for 3 years. Nobody had looked. We'd been coaching reps to focus on getting to the economic buyer fast. The data said the opposite: depth of relationship predicted outcomes more than speed of access. We rebuilt our qualification criteria around it. Pipeline conversion improved 18% in the next two quarters without changing headcount or ICP.",
      hashtags: ["revops", "salesops", "b2bsales"],
      contentAngles: ["Revenue Growth", "Data-Driven Decisions", "B2B Sales Strategy"],
      authorRole: "Revenue Operations",
      frameworkName: "Data drop",
      scores: { hook: 74, specificity: 88, clarity: 82, emotional: 58, cta: 63 },
    },
    // ── VP Customer Success ──
    {
      title: "The customer health score that predicted churn 60 days early",
      rawContent:
        "We spent a year building a customer health score with 14 variables — usage, support tickets, NPS, login frequency. It predicted churn 2 weeks out, which gave us almost no time to act. When we stripped it back to 2 signals — days since last active user session and whether the integration was still running — predictive accuracy went up and lead time extended to 60 days. Simpler models forced us to focus on the signals that actually mattered. The 14-variable score was giving us precision theatre. Two signals gave us actual time to save accounts.",
      hashtags: ["customersuccess", "churnprevention", "saas"],
      contentAngles: ["Customer Success", "Revenue Growth", "Data-Driven Decisions"],
      authorRole: "VP Customer Success",
      frameworkName: "Before · After · Bridge",
      scores: { hook: 78, specificity: 85, clarity: 83, emotional: 66, cta: 68 },
    },
    // ── Head of People ──
    {
      title: "Exit interviews told us nothing. Stay interviews changed everything.",
      rawContent:
        "For 3 years we ran exit interviews and categorized the feedback into themes. Attrition stayed flat at 22% annually. On a hunch, we started running 'stay interviews' — 30-minute conversations with people who had been with us 12+ months asking: 'what would make you leave?' The answers were completely different from what we heard in exit interviews. People leaving tell you why they left. People staying tell you what's at risk. The top risk: growth trajectory — not compensation, not culture, not management. We restructured our L&D budget accordingly. Attrition dropped to 14% in the following year.",
      hashtags: ["hr", "retention", "peopleleadership"],
      contentAngles: ["Hiring & Culture", "Team Building", "Leadership Development"],
      authorRole: "Head of People",
      frameworkName: "Counter-take",
      scores: { hook: 81, specificity: 80, clarity: 84, emotional: 74, cta: 70 },
    },
    // ── Growth PM ──
    {
      title: "We ran 40 A/B tests last quarter. 38 were a waste of time.",
      rawContent:
        "Our growth team shipped 40 experiments last quarter. 38 were underpowered — we didn't have the traffic to reach statistical significance before business pressure forced a call. We were getting the velocity of a high-output team with the reliability of noise. Two changes fixed it: we now require a pre-experiment power calculation before any test ships, and tests under 2000 daily sessions per variant go into a 'learn' bucket, not a 'decide' bucket. Since the change, we've run 12 experiments. 5 produced statistically significant results. Three of those drove real lift. Higher quality, lower volume, better decisions.",
      hashtags: ["growthhacking", "abtesting", "productgrowth"],
      contentAngles: ["Go-to-Market", "Data-Driven Decisions"],
      authorRole: "Growth PM",
      frameworkName: "5-Why Breakdown",
      scores: { hook: 79, specificity: 87, clarity: 81, emotional: 60, cta: 65 },
    },
    // ── Sales Lead (Founder's team) ──
    {
      title: "The first 10 customers taught me more than the next 100",
      rawContent:
        "When I was doing founder-led sales, my close rate on the first 10 customers was 80%. By customers 50-60, it was 35%. I assumed that was normal — market saturation, harder segment. Looking back, the difference was engagement depth. The first 10 customers had 6+ touchpoints before signing. I knew their exact situation, their internal champion, their competitor context. By customer 50, I was running a process: demo, proposal, follow-up. Process killed personalisation. Now I hire reps and tell them: the first 3 calls with any prospect should feel like you're solving their specific problem, not running a playbook.",
      hashtags: ["foundersales", "b2bsales", "startups"],
      contentAngles: ["B2B Sales Strategy", "Founder Lessons", "Go-to-Market"],
      authorRole: "Sales Lead",
      frameworkName: "Hook · Story · Lesson",
      scores: { hook: 77, specificity: 79, clarity: 80, emotional: 71, cta: 67 },
    },
    // ── SDR Manager ──
    {
      title: "Cold email reply rates tripled when we stopped personalising the opener",
      rawContent:
        "For 6 months we trained SDRs to personalise the first 2 lines of every cold email — LinkedIn activity, recent company news, podcast appearances. Reply rates averaged 4.2%. Then we tested a version with no personalisation at all: a direct, specific statement of the problem we solve and who we solve it for. Reply rates hit 12.8%. The personalisation was costing us clarity. Prospects don't want to be impressed that you read their LinkedIn — they want to know in 10 seconds if this is relevant to them. Relevance beats flattery. It always has.",
      hashtags: ["sdrs", "coldemail", "salesprospecting"],
      contentAngles: ["B2B Sales Strategy", "Revenue Growth"],
      authorRole: "SDR Manager",
      frameworkName: "Data drop",
      scores: { hook: 80, specificity: 85, clarity: 82, emotional: 65, cta: 72 },
    },
    // ── Data Analyst ──
    {
      title: "The metric our leadership team watched every week was measuring the wrong thing",
      rawContent:
        "For two years, our weekly leadership meeting opened with weekly active users. It looked healthy — steady 8% growth quarter over quarter. When we dug into cohort retention, the picture was different. New user activation was climbing, but users acquired in the last 6 months were churning at twice the rate of older cohorts. WAU was growing because acquisition masked the churn. We'd been optimising the funnel top without noticing the funnel floor was leaking. The fix wasn't a new metric — it was adding one cohort view to the weekly dashboard. A single chart changed every roadmap conversation that followed.",
      hashtags: ["analytics", "productmetrics", "saas"],
      contentAngles: ["Data-Driven Decisions", "Product Leadership"],
      authorRole: "Data Analyst",
      frameworkName: "5-Why Breakdown",
      scores: { hook: 76, specificity: 86, clarity: 83, emotional: 62, cta: 64 },
    },
  ].map((s) => ({
    title: s.title,
    rawContent: s.rawContent,
    hashtags: s.hashtags,
    contentType: "post" as const,
    contentAngles: s.contentAngles,
    status: "unused" as const,
    source: "manual" as const,
    recommendedAuthorId: authorByRole[s.authorRole] ?? null,
    bestFrameworkId: fwByName[s.frameworkName] ?? null,
    hookStrengthScore: s.scores.hook,
    specificityScore: s.scores.specificity,
    clarityScore: s.scores.clarity,
    emotionalResonanceScore: s.scores.emotional,
    callToActionScore: s.scores.cta,
  }));
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("⚡ Clearing database…");

  // Truncate in dependency order
  await db.execute(sql`TRUNCATE TABLE
    sessions, auth_tokens, oauth_states,
    design_briefs, analytics, edits,
    posts,
    signals,
    transcripts,
    author_content_angles,
    content_angles,
    authors,
    users,
    frameworks
  CASCADE`);

  console.log("✓ Database cleared.\n");

  // ── Frameworks ────────────────────────────────────────────────
  console.log("Seeding frameworks…");
  const insertedFrameworks = await db.insert(schema.frameworks).values(FRAMEWORKS).returning();
  const fwByName: Record<string, number> = {};
  for (const fw of insertedFrameworks) fwByName[fw.name] = fw.id;
  console.log(`✓ ${insertedFrameworks.length} frameworks\n`);

  // ── Content angles ────────────────────────────────────────────
  console.log("Seeding content angles…");
  const insertedAngles = await db
    .insert(schema.contentAngles)
    .values(CONTENT_ANGLE_NAMES.map((name) => ({ name })))
    .returning();
  const angleByName: Record<string, number> = {};
  for (const a of insertedAngles) angleByName[a.name] = a.id;
  console.log(`✓ ${insertedAngles.length} content angles\n`);

  // ── Superadmins (no author) ────────────────────────────────────
  console.log("Seeding superadmins…");
  const superadminRows = await db
    .insert(schema.users)
    .values(
      SUPERADMINS.map((sa) => ({
        email: sa.email,
        role: "admin" as const,
        passwordHash: hashPassword(sa.password),
        active: true,
      }))
    )
    .returning();
  console.log(`✓ ${superadminRows.length} superadmins\n`);

  // ── Admins + users per admin ──────────────────────────────────
  const authorByRole: Record<string, number> = {};
  const credLines: string[] = [
    "=".repeat(60),
    "  SIGNAL — Demo Credentials",
    "=".repeat(60),
    "",
    "NOTE: Superadmins are stored as role=admin in the DB.",
    "      Add their emails to ALLOWED_EMAILS env var for",
    "      full superadmin access.",
    "",
    "─── SUPERADMINS ───────────────────────────────────────",
    ...SUPERADMINS.map((sa) => `  ${sa.email.padEnd(36)} ${sa.password}`),
    "",
  ];

  for (const admin of TEAM) {
    console.log(`Seeding admin: ${admin.name} (${admin.role})…`);

    // Admin author
    const [adminAuthor] = await db
      .insert(schema.authors)
      .values({
        name: admin.name,
        role: admin.role,
        bio: admin.bio,
        voiceProfile: admin.voiceProfile,
        styleNotes: admin.styleNotes,
        contentAngles: admin.contentAngles,
        active: true,
      })
      .returning();

    authorByRole[admin.role] = adminAuthor.id;

    // Link admin author to content angles
    const adminAngleLinks = admin.contentAngles
      .map((a) => angleByName[a])
      .filter(Boolean)
      .map((id) => ({ authorId: adminAuthor.id, contentAngleId: id }));
    if (adminAngleLinks.length) await db.insert(schema.authorContentAngles).values(adminAngleLinks);

    // Admin user
    await db.insert(schema.users).values({
      email: admin.email,
      role: "admin" as const,
      passwordHash: hashPassword(admin.password),
      active: true,
      authorId: adminAuthor.id,
    });

    credLines.push(`─── ADMIN: ${admin.name} (${admin.role}) ${"─".repeat(Math.max(0, 40 - admin.name.length - admin.role.length))}`);
    credLines.push(`  ${admin.email.padEnd(36)} ${admin.password}`);
    credLines.push(`  Users invited by this admin:`);

    // Users under this admin
    for (const user of admin.users) {
      const [userAuthor] = await db
        .insert(schema.authors)
        .values({
          name: user.name,
          role: user.role,
          bio: user.bio,
          contentAngles: user.contentAngles,
          active: true,
        })
        .returning();

      authorByRole[user.role] = userAuthor.id;

      const userAngleLinks = user.contentAngles
        .map((a) => angleByName[a])
        .filter(Boolean)
        .map((id) => ({ authorId: userAuthor.id, contentAngleId: id }));
      if (userAngleLinks.length) await db.insert(schema.authorContentAngles).values(userAngleLinks);

      await db.insert(schema.users).values({
        email: user.email,
        role: "user" as const,
        passwordHash: hashPassword(user.password),
        active: true,
        authorId: userAuthor.id,
        invitedBy: admin.email,
      });

      credLines.push(`    ${user.email.padEnd(34)} ${user.password}  (${user.name}, ${user.role})`);
    }

    credLines.push("");
    console.log(`  ✓ ${admin.users.length} users`);
  }

  // ── Signals ───────────────────────────────────────────────────
  console.log("\nSeeding signals…");
  const signalDefs = buildSignals(authorByRole, fwByName);
  await db.insert(schema.signals).values(signalDefs);
  console.log(`✓ ${signalDefs.length} signals\n`);

  // ── Write credentials file ────────────────────────────────────
  credLines.push("=".repeat(60));
  const outPath = path.join(__dirname, "..", "CREDENTIALS.txt");
  fs.writeFileSync(outPath, credLines.join("\n"), "utf8");
  console.log(`✓ Credentials written to CREDENTIALS.txt\n`);

  // ── Summary ───────────────────────────────────────────────────
  const totalUsers = SUPERADMINS.length + TEAM.length + TEAM.reduce((n, a) => n + a.users.length, 0);
  console.log("─".repeat(50));
  console.log(`  Superadmins : ${SUPERADMINS.length}`);
  console.log(`  Admins      : ${TEAM.length}`);
  console.log(`  Users       : ${TEAM.reduce((n, a) => n + a.users.length, 0)}`);
  console.log(`  Total users : ${totalUsers}`);
  console.log(`  Authors     : ${TEAM.length + TEAM.reduce((n, a) => n + a.users.length, 0)}`);
  console.log(`  Frameworks  : ${insertedFrameworks.length}`);
  console.log(`  Angles      : ${insertedAngles.length}`);
  console.log(`  Signals     : ${signalDefs.length}`);
  console.log("─".repeat(50));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
