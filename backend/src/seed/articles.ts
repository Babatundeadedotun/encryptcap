/** The four research pieces from the prototype, in the stored block format. */
import type { ArticleBlock, ArticleCategory } from '../models/Article.js';

export interface SeedArticle {
  slug: string;
  category: ArticleCategory;
  title: string;
  dek: string;
  minutes: number;
  publishedAt: Date;
  body: ArticleBlock[];
}

export const SEED_ARTICLES: SeedArticle[] = [
  {
    slug: 'bitcoin-hedge',
    category: 'Crypto',
    title: 'Bitcoin as a hedge: what Nigerian investors should actually know',
    dek: 'A sober look at whether bitcoin belongs in a naira-weary portfolio — and where it doesn’t.',
    minutes: 3,
    publishedAt: new Date(2026, 5, 12),
    body: [
      {
        type: 'para',
        text: 'If you hold naira, you’ve felt the reason bitcoin keeps coming up in every conversation. When your currency loses value year after year, anything that isn’t naira starts to look like shelter. Bitcoin is priced in dollars, it isn’t controlled by any central bank, and for a stretch of the last decade it rose faster than almost anything else. For a Nigerian saver watching purchasing power drain away, that’s a powerful story.',
      },
      { type: 'para', text: 'But a hedge and a bet are not the same thing, and bitcoin behaves like both.' },
      {
        type: 'lead',
        heading: 'The case people get right.',
        text: 'Bitcoin is genuinely uncorrelated with the naira. It can’t be printed, devalued by policy, or frozen by a local bank. Over long horizons, holders have been rewarded. As a small slice of a wider portfolio, it does something naira savings simply can’t — it moves independently of decisions made in Abuja.',
      },
      {
        type: 'lead',
        heading: 'The part people skip.',
        text: 'Bitcoin is volatile in a way most savers underestimate until they live through it. Drops of 50% or more have happened repeatedly, and they can last over a year. “Uncorrelated with the naira” doesn’t mean “stable” — it means it has its own, often violent, cycles. If you’d need the money within two years, or a paper loss would keep you up at night, that volatility isn’t a footnote. It’s the main event.',
      },
      {
        type: 'lead',
        heading: 'Three things decide whether it helps or hurts you:',
        text: '',
      },
      {
        type: 'list',
        items: [
          'Position size. The same asset is prudent at 5% of your savings and reckless at 80%.',
          'Custody. “Not your keys, not your coins” is the difference between owning bitcoin and owning an IOU on an exchange that could freeze, fail, or be hacked.',
          'Time horizon. Bitcoin has rewarded patience and punished urgency. It’s a multi-year position or it’s a coin flip.',
        ],
      },
      {
        type: 'lead',
        heading: 'How this differs from what we do.',
        text: 'Encrypt Capital doesn’t chase an asset and hope it climbs. We trade a defined strategy around scheduled market events, with automated stop-losses and profits taken in USD. Bitcoin is a hold-and-wait bet on one asset; our approach is an active, risk-controlled process. Both can hedge the naira — but they’re not the same risk, and they don’t belong in the same mental bucket.',
      },
      {
        type: 'lead',
        heading: 'The honest verdict.',
        text: 'Bitcoin can earn a place in a naira-weary portfolio — as a small, long-horizon, properly-held position you’ve sized so a bad year won’t break you. It’s not a savings account, not a guarantee, and not a substitute for understanding what you own.',
      },
      {
        type: 'para',
        text: 'The full study breaks down the numbers, the historical drawdowns, and a framework for sizing a position — download it below.',
      },
    ],
  },
  {
    slug: 'nfp-explained',
    category: 'Fundamentals',
    title: 'NFP: the one release we build our whole month around',
    dek: 'What the U.S. jobs report is, why it moves the market so hard — and how we trade it without guessing.',
    minutes: 2,
    publishedAt: new Date(2026, 4, 8),
    body: [
      {
        type: 'para',
        text: 'Once a month, on the first Friday, the U.S. publishes its Non-Farm Payrolls report — a count of jobs added or lost across the world’s largest economy. Within seconds of the number hitting the wire, trillions of dollars of positioning adjusts. Currencies, gold and indices can move more in five minutes than they otherwise would in a week.',
      },
      {
        type: 'lead',
        heading: 'Why it matters so much.',
        text: 'Jobs data feeds directly into interest-rate expectations, and interest rates price every asset on earth. A surprise in either direction forces the entire market to reprice at once. That makes NFP one of the few genuinely scheduled moments of high movement — you know the date and the time months in advance.',
      },
      {
        type: 'lead',
        heading: 'How we approach it.',
        text: 'We don’t predict the number. Our system places pre-planned positions around the release with defined entries, automated stop-losses and exits sized for the volatility. The edge isn’t clairvoyance — it’s preparation, speed and discipline at a moment when most participants have none of the three.',
      },
      {
        type: 'para',
        text: 'The full note walks through recent NFP releases, the moves they produced, and the risk rules our system applies to each one.',
      },
    ],
  },
  {
    slug: 'naira-five-years',
    category: 'Nigeria & the naira',
    title: 'What five years of devaluation actually did to your savings',
    dek: 'The arithmetic of holding naira since 2021 — and why a “good” savings rate still lost you money.',
    minutes: 2,
    publishedAt: new Date(2026, 3, 3),
    body: [
      {
        type: 'para',
        text: 'In 2021 you could buy a dollar for roughly ₦410. Today it costs several times that. If your savings lived in naira through those years, the number in your account may have grown — but the things it can buy shrank, dramatically.',
      },
      {
        type: 'lead',
        heading: 'The trap is the nominal rate.',
        text: 'A savings account paying 8–22% feels productive. Set it against annual inflation that has run between 23% and 33%, and the real return is negative every single year. A 15% return in a 25% inflation year is not a profit. It’s a slower loss.',
      },
      {
        type: 'lead',
        heading: 'The uncomfortable conclusion.',
        text: 'For a Nigerian saver, doing nothing is an active position — a leveraged bet on the naira’s stability, taken by default. Diversifying some savings into dollar-denominated assets isn’t exotic; over the last five years it was the single most consequential financial decision available to ordinary households.',
      },
      {
        type: 'para',
        text: 'The full study charts the devaluation, inflation and deposit-rate data side by side, with sources, so you can check every figure yourself.',
      },
    ],
  },
  {
    slug: 'position-sizing',
    category: 'Strategy',
    title: 'Position sizing: the boring discipline that decides everything',
    dek: 'Why how much you risk matters more than what you buy — in our system and in your own portfolio.',
    minutes: 2,
    publishedAt: new Date(2026, 2, 6),
    body: [
      {
        type: 'para',
        text: 'Ask a struggling trader what went wrong and you’ll hear about a bad call, a surprise announcement, a manipulated market. Ask a professional risk desk and you’ll hear something less dramatic: the position was too big.',
      },
      {
        type: 'lead',
        heading: 'The math is unforgiving.',
        text: 'Lose 10% and you need 11% to recover. Lose 50% and you need 100%. Position sizing exists to keep every individual loss in the first category — small enough that recovery is routine, never a heroic comeback.',
      },
      {
        type: 'lead',
        heading: 'How we apply it.',
        text: 'Every trade our system places is sized from the account’s current equity with a hard cap on risk per event, enforced in code before the trade opens. No position can “double down.” No losing month can compound into a losing quarter by emotion alone.',
      },
      {
        type: 'lead',
        heading: 'What you can steal from this.',
        text: 'Whatever you invest in — stocks, crypto, a friend’s business — decide the maximum loss before you enter, and size the position so that loss is survivable. It’s the least glamorous rule in finance and the most reliably profitable one.',
      },
      {
        type: 'para',
        text: 'The full note includes the sizing formula we use and a worked example you can apply to any portfolio.',
      },
    ],
  },
];
