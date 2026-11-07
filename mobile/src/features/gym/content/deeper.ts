/**
 * "Question it": real-world style claims (viral posts, ads, headlines, forwards).
 * Socratic format based on what worked best in critical-thinking research: authentic
 * problems plus dialogue. Step 1: pick the most useful question to ask. Step 2: judge.
 * Draft, self-checked; needs independent review before release.
 */

export type DeeperItem = {
  id: string;
  source: string; // e.g. "WhatsApp forward"
  claim: string;
  probes: string[];
  bestProbe: number;
  probeWhy: string;
  verdicts: string[];
  bestVerdict: number;
  takeaway: string;
};

export const DEEPER: DeeperItem[] = [
  {
    id: 'dp-01',
    source: 'WhatsApp forward',
    claim:
      '"Drinking hot water with lemon every morning flushes out all toxins. Doctors don’t want you to know!"',
    probes: [
      'Which toxins, and what evidence shows lemon water removes them?',
      'How hot should the water be?',
      'Who sent this to the group?',
    ],
    bestProbe: 0,
    probeWhy:
      'Vague words like "toxins" hide the claim. Asking "which ones, and what is the evidence?" forces it to become testable.',
    verdicts: [
      'Doubt it until real evidence is shown',
      'Believe it, many people shared it',
      'Believe it, lemons are healthy',
    ],
    bestVerdict: 0,
    takeaway:
      'Your liver and kidneys already handle waste. "Secret the experts hide" is a common sign of a weak claim.',
  },
  {
    id: 'dp-02',
    source: 'Coaching ad',
    claim: '"98% of our students cleared the exam!"',
    probes: [
      'Out of how many students, and who was counted?',
      'Which city is the centre in?',
      'How long are the classes?',
    ],
    bestProbe: 0,
    probeWhy:
      'Percentages can hide small or hand-picked groups. If only toppers were counted, 98% means little.',
    verdicts: [
      'Interesting, but need the full numbers first',
      'Proves this is the best coaching',
      'Means I will definitely clear it there',
    ],
    bestVerdict: 0,
    takeaway:
      'Ask "out of how many?" and "who was left out?" before trusting any success rate.',
  },
  {
    id: 'dp-03',
    source: 'News headline',
    claim: '"Study: People who sleep 9 hours are less successful."',
    probes: [
      'Did sleep cause it, or do other differences explain both?',
      'Which newspaper printed it?',
      'What time do successful people wake up?',
    ],
    bestProbe: 0,
    probeWhy:
      'A link is not a cause. Illness, job type or age could affect both sleep and success.',
    verdicts: [
      'A correlation, so it says little about what I should do',
      'I should sleep less to succeed',
      'Sleep is bad for you',
    ],
    bestVerdict: 0,
    takeaway:
      'When a headline links two things, ask what else could explain both.',
  },
  {
    id: 'dp-04',
    source: 'Instagram reel',
    claim:
      '"I studied only 2 hours a day and topped. Hard work is overrated." (2M views)',
    probes: [
      'How many people did the same and did not top?',
      'What camera did they use?',
      'Is the person good looking?',
    ],
    bestProbe: 0,
    probeWhy:
      'We only see the winners who post. The many who tried the same thing and failed are invisible (survivorship bias).',
    verdicts: [
      'One story, not a reliable plan for me',
      'I should study 2 hours too',
      'Views prove it works',
    ],
    bestVerdict: 0,
    takeaway: 'For every success story you see, ask about the ones you don’t.',
  },
  {
    id: 'dp-05',
    source: 'Product ad',
    claim: '"Clinically proven to boost focus by 300%!"',
    probes: [
      'What was measured, compared with what, and who ran the study?',
      'What flavours does it come in?',
      'Is there a discount today?',
    ],
    bestProbe: 0,
    probeWhy:
      '"Clinically proven" can mean a tiny, company-run test. A number without a comparison is meaningless.',
    verdicts: [
      'Treat it as marketing until independent evidence appears',
      'Buy it, it is clinically proven',
      'Ignore all products forever',
    ],
    bestVerdict: 0,
    takeaway:
      'Look for who tested it, against what, and whether anyone independent found the same.',
  },
  {
    id: 'dp-06',
    source: 'Family group chat',
    claim:
      '"My neighbour’s cousin got sick after the new phone tower came up. Towers cause illness."',
    probes: [
      'Do areas with towers have more illness than similar areas without?',
      'How tall is the tower?',
      'What is the cousin’s name?',
    ],
    bestProbe: 0,
    probeWhy:
      'One case after an event does not show the event caused it. You need a fair comparison across many people.',
    verdicts: [
      'An anecdote, not evidence of cause',
      'Proof towers are dangerous',
      'The cousin is lying',
    ],
    bestVerdict: 0,
    takeaway:
      '"After" does not mean "because". Ask what happens in a fair comparison.',
  },
  {
    id: 'dp-07',
    source: 'Debate on X',
    claim:
      '"If you support exam reforms, you obviously want students to stop studying."',
    probes: [
      'Is that what supporters actually say, or an exaggeration?',
      'How many followers does the poster have?',
      'When was it posted?',
    ],
    bestProbe: 0,
    probeWhy:
      'Twisting someone’s view into an extreme one (a straw man) makes it easy to attack but says nothing about the real view.',
    verdicts: [
      'A straw man; look up the real position',
      'A fair summary of reformers',
      'Proof reforms are bad',
    ],
    bestVerdict: 0,
    takeaway:
      'Before arguing, restate the other side’s view in a way they would agree with.',
  },
  {
    id: 'dp-08',
    source: 'YouTube thumbnail',
    claim: '"Scientists SHOCKED: This one habit doubles your IQ"',
    probes: [
      'Which scientists, which study, and what exactly changed?',
      'How long is the video?',
      'What colour is the thumbnail?',
    ],
    bestProbe: 0,
    probeWhy:
      'Emotional words like "SHOCKED" and huge promises are built for clicks. The real study (if any) is usually much smaller.',
    verdicts: [
      'Clickbait until the source is shown',
      'I should start this habit today',
      'Science is fake',
    ],
    bestVerdict: 0,
    takeaway:
      'The bigger and more emotional the promise, the more evidence you should want.',
  },
  {
    id: 'dp-09',
    source: 'Friend’s advice',
    claim:
      '"Everyone in our batch uses this app, so it must be the best for prep."',
    probes: [
      'Does it actually improve scores compared with other methods?',
      'Is the app free?',
      'Does it have dark mode?',
    ],
    bestProbe: 0,
    probeWhy: 'Popularity shows what people chose, not whether it works best.',
    verdicts: [
      'Popular, but that alone does not show it works',
      'It must be the best',
      'Popular things are always bad',
    ],
    bestVerdict: 0,
    takeaway: 'Ask "does it work?" separately from "do many people use it?".',
  },
  {
    id: 'dp-10',
    source: 'Survey result',
    claim:
      '"An online poll of our followers found 85% think our policy is great."',
    probes: [
      'Who could vote, and are followers typical of everyone?',
      'What font was the poll in?',
      'How many likes did it get?',
    ],
    bestProbe: 0,
    probeWhy:
      'People who follow an account already lean towards it. The sample is biased before anyone votes.',
    verdicts: [
      'Tells us about followers, not the public',
      'Shows most people agree',
      'Polls are always rigged',
    ],
    bestVerdict: 0,
    takeaway: 'A result only speaks for the group that was asked.',
  },
  {
    id: 'dp-11',
    source: 'Motivational post',
    claim: '"Either you wake up at 5 a.m. or you’ll never be successful."',
    probes: [
      'Are there successful people who wake later, and could other habits matter more?',
      'What alarm sound is best?',
      'Who designed the poster?',
    ],
    bestProbe: 0,
    probeWhy:
      'This offers only two options when many exist (a false dilemma). One counter-example breaks it.',
    verdicts: [
      'A false choice; many routines can work',
      'I must wake at 5 a.m.',
      'Waking early is bad',
    ],
    bestVerdict: 0,
    takeaway: 'When you hear "either… or…", ask what other options exist.',
  },
  {
    id: 'dp-12',
    source: 'Health headline',
    claim: '"New study: chocolate improves memory!" (tested on 12 mice)',
    probes: [
      'Was it tested in people, and how large was the study?',
      'Which brand of chocolate?',
      'Do mice like chocolate?',
    ],
    bestProbe: 0,
    probeWhy:
      'Small animal studies are early clues. Many results in mice do not hold up in people.',
    verdicts: [
      'An early clue, not advice for me',
      'Eat more chocolate to study better',
      'All mouse research is useless',
    ],
    bestVerdict: 0,
    takeaway:
      'Check who or what was studied, and how many, before changing your life.',
  },
];
