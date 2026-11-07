/**
 * Reasoning exercise bank, version 1.
 * Status: written and self-checked by the RECLAIM team (draft). Needs an independent
 * expert review before public release. Each item has one defensible best answer.
 */

export const CONTENT_VERSION = 'reasoning-2026-11-v1';

export type ReasoningSkill =
  | 'assumptions'
  | 'causation'
  | 'evidence'
  | 'inference'
  | 'fallacies'
  | 'arguments';

export const SKILL_LABELS: Record<ReasoningSkill, string> = {
  assumptions: 'Spotting assumptions',
  causation: 'Cause vs coincidence',
  evidence: 'Weighing evidence',
  inference: 'Drawing conclusions',
  fallacies: 'Spotting fallacies',
  arguments: 'Judging arguments',
};

export type ReasoningItem = {
  id: string;
  skill: ReasoningSkill;
  difficulty: 1 | 2 | 3;
  passage: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export const REASONING: ReasoningItem[] = [
  // ---------- Assumptions ----------
  {
    id: 'asm-01',
    skill: 'assumptions',
    difficulty: 1,
    passage:
      'Riya topped the mock test, so she will definitely top the final exam.',
    question: 'What is this conclusion quietly assuming?',
    options: [
      'Mock test results reliably predict final results',
      'Riya studied harder than everyone',
      'The final exam is easier than the mock',
      'Nobody else took the mock test',
    ],
    answer: 0,
    explanation:
      'The jump from "topped the mock" to "will top the final" only works if mock results reliably predict finals. That link is assumed, not shown.',
  },
  {
    id: 'asm-02',
    skill: 'assumptions',
    difficulty: 1,
    passage:
      'Our coaching centre has the most students in the city, so it must give the best teaching.',
    question: 'Which assumption does this rely on?',
    options: [
      'Students choose a centre mainly for teaching quality',
      'Bigger buildings are more comfortable',
      'Teachers are paid more at large centres',
      'The city has only one coaching centre',
    ],
    answer: 0,
    explanation:
      'Popularity could come from location, price or advertising. The argument assumes size reflects teaching quality.',
  },
  {
    id: 'asm-03',
    skill: 'assumptions',
    difficulty: 2,
    passage:
      'Switching the office to a four-day week will raise output, because rested people work better.',
    question: 'What must be true for this argument to hold?',
    options: [
      'The extra rest outweighs the lost working day',
      'Everyone prefers a four-day week',
      'Other companies have tried it',
      'Rested people sleep longer',
    ],
    answer: 0,
    explanation:
      'Better rest only raises total output if the gain per day makes up for losing a whole day. That trade-off is assumed.',
  },
  {
    id: 'asm-04',
    skill: 'assumptions',
    difficulty: 2,
    passage:
      'This phone has a 200-megapixel camera, so it takes better photos than phones with 50 megapixels.',
    question: 'Which hidden assumption is being made?',
    options: [
      'More megapixels always means better photo quality',
      'The phone is more expensive',
      'People only care about cameras',
      '50-megapixel phones are old',
    ],
    answer: 0,
    explanation:
      'Photo quality also depends on the sensor size, lens and processing. The argument assumes megapixels alone decide quality.',
  },
  {
    id: 'asm-05',
    skill: 'assumptions',
    difficulty: 3,
    passage:
      'A new library opened near the college, so students will now read more books.',
    question: 'Which assumption is needed?',
    options: [
      'Distance to a library was what stopped students reading',
      'The library is bigger than the old one',
      'Students like the library building',
      'Books are free at the library',
    ],
    answer: 0,
    explanation:
      'Opening a nearby library only increases reading if access was the barrier. If students lacked time or interest, nothing changes.',
  },

  // ---------- Causation ----------
  {
    id: 'cau-01',
    skill: 'causation',
    difficulty: 1,
    passage:
      'People who drink more coffee report higher productivity. So coffee makes people productive.',
    question: 'What is the main weakness?',
    options: [
      'A link between two things does not show one causes the other',
      'Coffee is unhealthy',
      'Productivity cannot be measured',
      'Some people dislike coffee',
    ],
    answer: 0,
    explanation:
      'Busy, productive people might simply drink more coffee. A correlation alone cannot tell us which way the cause runs, or if a third factor drives both.',
  },
  {
    id: 'cau-02',
    skill: 'causation',
    difficulty: 1,
    passage:
      'Ice-cream sales and drowning incidents both rise in the same months. Therefore ice cream causes drowning.',
    question: 'What best explains the pattern?',
    options: [
      'Hot weather increases both swimming and ice-cream sales',
      'Ice cream makes people tired in water',
      'Drowning makes people buy ice cream',
      'The data must be wrong',
    ],
    answer: 0,
    explanation:
      'A third factor, hot weather, drives both. This is a classic case of a hidden common cause.',
  },
  {
    id: 'cau-03',
    skill: 'causation',
    difficulty: 2,
    passage:
      'Students who own more books score higher in exams. So buying a child more books will raise their scores.',
    question: 'Which is the strongest objection?',
    options: [
      'Families that own many books may also support learning in other ways',
      'Books are expensive',
      'Exams do not test reading',
      'Some books are boring',
    ],
    answer: 0,
    explanation:
      'Book ownership may stand in for home environment, parental education or interest. Buying books alone may not reproduce those benefits.',
  },
  {
    id: 'cau-04',
    skill: 'causation',
    difficulty: 2,
    passage:
      'After the city installed more traffic cameras, accidents fell by 10% that year. The cameras clearly worked.',
    question: 'What would you most want to check?',
    options: [
      'Whether accidents also fell in similar cities without new cameras',
      'How much the cameras cost',
      'Whether drivers liked the cameras',
      'How many cameras were installed',
    ],
    answer: 0,
    explanation:
      'Accidents might have dropped anyway (weather, new roads, fuel prices). Comparing with similar places without cameras helps separate the effect.',
  },
  {
    id: 'cau-05',
    skill: 'causation',
    difficulty: 3,
    passage:
      'Hospitals with more doctors have higher death rates. So having more doctors is dangerous.',
    question: 'What is the best explanation?',
    options: [
      'Larger hospitals treat sicker patients, so they need more doctors',
      'Doctors spread infections',
      'The figures are made up',
      'Small hospitals hide deaths',
    ],
    answer: 0,
    explanation:
      'The cause likely runs the other way: hospitals that handle serious cases need more doctors and also see more deaths.',
  },

  // ---------- Evidence ----------
  {
    id: 'evi-01',
    skill: 'evidence',
    difficulty: 1,
    passage:
      'A viral post says a herbal drink cures diabetes. It shows three people who say they feel better.',
    question: 'Why is this weak evidence?',
    options: [
      'A few personal stories cannot show a treatment works',
      'Herbal drinks are always unsafe',
      'Diabetes cannot be cured by anything',
      'The post was shared too many times',
    ],
    answer: 0,
    explanation:
      'Testimonials are small, self-selected and uncontrolled. Showing a treatment works needs a fair comparison, such as a controlled trial.',
  },
  {
    id: 'evi-02',
    skill: 'evidence',
    difficulty: 1,
    passage:
      'A study funded by a soft-drink company found that sugary drinks do not cause weight gain.',
    question: 'What is the most reasonable response?',
    options: [
      'Look for independent studies before trusting the result',
      'Reject it, all funded research is false',
      'Accept it, it is a study',
      'Ignore weight gain altogether',
    ],
    answer: 0,
    explanation:
      'Funding does not make a study false, but it is a reason for extra care. Independent studies that agree would make the claim more trustworthy.',
  },
  {
    id: 'evi-03',
    skill: 'evidence',
    difficulty: 2,
    passage:
      'An online poll on a fitness app found 90% of people exercise daily. So most people exercise daily.',
    question: 'What is wrong with this conclusion?',
    options: [
      'People on a fitness app are not typical of everyone',
      'Polls are always fake',
      '90% is too high to be real',
      'Exercise cannot be counted',
    ],
    answer: 0,
    explanation:
      'The sample is skewed: fitness-app users are more likely to exercise. A result only generalises to the group the sample represents.',
  },
  {
    id: 'evi-04',
    skill: 'evidence',
    difficulty: 2,
    passage:
      'A trial gave 20 students a memory supplement. Their scores rose 5%. There was no comparison group.',
    question: 'What is the biggest problem?',
    options: [
      'Without a comparison group, the rise could be from practice or chance',
      '20 students is the wrong number',
      'Supplements are illegal',
      'Scores should rise more than 5%',
    ],
    answer: 0,
    explanation:
      'Scores often rise on a second try just from practice. A control group taking no supplement is needed to see the supplement’s own effect.',
  },
  {
    id: 'evi-05',
    skill: 'evidence',
    difficulty: 3,
    passage:
      'Claim A cites one large trial of 10,000 people. Claim B cites twelve small studies of 30 people each, all from the same lab.',
    question: 'Which statement is most reasonable?',
    options: [
      'Claim A has stronger evidence, though both deserve scrutiny',
      'Claim B is stronger because it has more studies',
      'Both are equally strong',
      'Neither counts because studies can be wrong',
    ],
    answer: 0,
    explanation:
      'Twelve tiny studies from one lab share the same methods and biases. One large, well-run trial usually tells us more, though it should still be replicated.',
  },

  // ---------- Inference ----------
  {
    id: 'inf-01',
    skill: 'inference',
    difficulty: 1,
    passage: 'All the students in Room 4 passed. Arjun is in Room 4.',
    question: 'What must be true?',
    options: [
      'Arjun passed',
      'Arjun got the top score',
      'Everyone in the school passed',
      'Room 4 had easy questions',
    ],
    answer: 0,
    explanation:
      'If every student in Room 4 passed and Arjun is one of them, Arjun passed. Nothing more follows.',
  },
  {
    id: 'inf-02',
    skill: 'inference',
    difficulty: 1,
    passage:
      'If it rains, the match is cancelled. The match was not cancelled.',
    question: 'What can you conclude?',
    options: [
      'It did not rain',
      'It rained',
      'The match was played indoors',
      'Nothing can be concluded',
    ],
    answer: 0,
    explanation:
      'If rain always cancels the match, and the match was not cancelled, then it cannot have rained.',
  },
  {
    id: 'inf-03',
    skill: 'inference',
    difficulty: 2,
    passage: 'If it rains, the match is cancelled. The match was cancelled.',
    question: 'What can you conclude?',
    options: [
      'Nothing certain about the rain',
      'It rained',
      'It did not rain',
      'The match was rescheduled',
    ],
    answer: 0,
    explanation:
      'The match could be cancelled for other reasons. Assuming it rained is a common error called "affirming the consequent".',
  },
  {
    id: 'inf-04',
    skill: 'inference',
    difficulty: 2,
    passage: 'Some engineers are musicians. All musicians practise daily.',
    question: 'Which must be true?',
    options: [
      'Some engineers practise daily',
      'All engineers practise daily',
      'All musicians are engineers',
      'No engineer is a musician',
    ],
    answer: 0,
    explanation:
      'The engineers who are musicians practise daily, so at least some engineers do. We know nothing about the rest.',
  },
  {
    id: 'inf-05',
    skill: 'inference',
    difficulty: 3,
    passage:
      'Every person who passed the interview had a referral. Meera had a referral.',
    question: 'What follows?',
    options: [
      'We cannot tell whether Meera passed',
      'Meera passed the interview',
      'Meera failed the interview',
      'Everyone with a referral passed',
    ],
    answer: 0,
    explanation:
      'Having a referral was needed to pass, but it was not shown to be enough. Many people with referrals may still have failed.',
  },

  // ---------- Fallacies ----------
  {
    id: 'fal-01',
    skill: 'fallacies',
    difficulty: 1,
    passage:
      'You can’t trust Kabir’s point about climate change. He doesn’t even own a car.',
    question: 'What is the flaw?',
    options: [
      'It attacks the person instead of the argument',
      'It uses too many statistics',
      'It is too long',
      'It agrees with Kabir',
    ],
    answer: 0,
    explanation:
      'This is an "ad hominem": it criticises Kabir personally instead of addressing his evidence or reasoning.',
  },
  {
    id: 'fal-02',
    skill: 'fallacies',
    difficulty: 1,
    passage: 'Either you study 12 hours a day, or you will fail the exam.',
    question: 'What is wrong with this claim?',
    options: [
      'It presents only two options when many exist',
      'It is too motivating',
      'Exams are not important',
      '12 hours is too short',
    ],
    answer: 0,
    explanation:
      'This is a false dilemma. Many other study patterns could lead to passing.',
  },
  {
    id: 'fal-03',
    skill: 'fallacies',
    difficulty: 2,
    passage:
      'If we allow phones in class for research, next students will watch films, then nobody will learn anything.',
    question: 'Which flaw is this?',
    options: [
      'A chain of unlikely consequences presented as certain',
      'An attack on a person',
      'A correct prediction',
      'A statistic used wrongly',
    ],
    answer: 0,
    explanation:
      'This is a "slippery slope": it assumes one step must lead to extreme outcomes without showing why.',
  },
  {
    id: 'fal-04',
    skill: 'fallacies',
    difficulty: 2,
    passage:
      'Millions of people use this app every day, so it must be good for you.',
    question: 'What is the flaw?',
    options: [
      'Popularity does not prove something is good',
      'Millions is an exaggeration',
      'Apps are always bad',
      'Daily use is impossible',
    ],
    answer: 0,
    explanation:
      'This is an "appeal to popularity". Many people doing something says nothing about whether it benefits them.',
  },
  {
    id: 'fal-05',
    skill: 'fallacies',
    difficulty: 3,
    passage:
      'Priya says we should reduce screen time. So she wants us to throw away our phones and live in the forest?',
    question: 'What is happening here?',
    options: [
      'Her view is twisted into an extreme version that is easy to attack',
      'Her argument is being fairly summarised',
      'The speaker agrees with Priya',
      'Priya is using a false dilemma',
    ],
    answer: 0,
    explanation:
      'This is a "straw man": it replaces a reasonable position with an exaggerated one and attacks that instead.',
  },

  // ---------- Arguments ----------
  {
    id: 'arg-01',
    skill: 'arguments',
    difficulty: 1,
    passage: 'Claim: Walking 30 minutes a day improves sleep.',
    question: 'Which evidence would support this best?',
    options: [
      'A trial where walkers slept better than a similar group who did not walk',
      'A celebrity who walks daily and sleeps well',
      'A survey of people who already love walking',
      'An advert for walking shoes',
    ],
    answer: 0,
    explanation:
      'A fair comparison with a similar group isolates the effect of walking. The others are anecdotes or biased samples.',
  },
  {
    id: 'arg-02',
    skill: 'arguments',
    difficulty: 1,
    passage:
      'Argument: Students should get free breakfast at school, because hungry students struggle to concentrate.',
    question: 'Which fact would weaken this most?',
    options: [
      'At this school, almost all students already eat breakfast at home',
      'Breakfast costs money',
      'Some students do not like breakfast food',
      'Teachers also get hungry',
    ],
    answer: 0,
    explanation:
      'If students are not actually hungry in the morning, the reason given for the policy no longer applies here.',
  },
  {
    id: 'arg-03',
    skill: 'arguments',
    difficulty: 2,
    passage:
      'Argument: Short-video apps should have time limits for teenagers, since heavy use is linked to weaker attention.',
    question: 'Which addition would make it strongest?',
    options: [
      'Evidence that limits actually reduce use and improve attention',
      'A list of popular short-video apps',
      'A quote from a famous person who dislikes apps',
      'The number of teenagers in the country',
    ],
    answer: 0,
    explanation:
      'The argument needs to show the proposed fix works, not just that the problem exists.',
  },
  {
    id: 'arg-04',
    skill: 'arguments',
    difficulty: 2,
    passage:
      'A company says: "Our course works. 95% of students who finished it got a job."',
    question: 'What important question is missing?',
    options: [
      'How many students started but did not finish?',
      'What colour is the company logo?',
      'How long is each video?',
      'Who designed the website?',
    ],
    answer: 0,
    explanation:
      'If many people dropped out, counting only finishers hides the failures. This is called "survivorship bias".',
  },
  {
    id: 'arg-05',
    skill: 'arguments',
    difficulty: 3,
    passage:
      'Two articles disagree about whether a diet works. One cites a review of 40 trials; the other cites the author’s own experience.',
    question: 'What is the most reasonable stance?',
    options: [
      'Give more weight to the review, while staying open to new evidence',
      'Trust the personal experience, it is more relatable',
      'Treat both as equally valid opinions',
      'Ignore both and decide by gut feeling',
    ],
    answer: 0,
    explanation:
      'A review of many trials summarises much more evidence than one person’s experience, though evidence can change as new studies appear.',
  },
  {
    id: 'arg-06',
    skill: 'arguments',
    difficulty: 3,
    passage:
      '"Our sales rose after we changed the logo, so the new logo increased sales." The change happened during the festival season.',
    question: 'What best describes the problem?',
    options: [
      'The festival season is another possible cause of the rise',
      'Logos never affect sales',
      'Sales cannot be measured',
      'The old logo was better',
    ],
    answer: 0,
    explanation:
      'Timing alone does not prove cause. Festival shopping could explain the rise, so the logo’s effect is unclear.',
  },
  {
    id: 'evi-06',
    skill: 'evidence',
    difficulty: 2,
    passage:
      'A headline says: "Study shows chocolate improves memory!" The study was done on 12 mice.',
    question: 'What is the most careful takeaway?',
    options: [
      'It is an early result that may not apply to people',
      'Eating chocolate will improve your memory',
      'Mice studies are always useless',
      'The headline is accurate',
    ],
    answer: 0,
    explanation:
      'Small animal studies can be useful starting points, but they often do not carry over to humans. The headline overstates the finding.',
  },
  {
    id: 'cau-06',
    skill: 'causation',
    difficulty: 3,
    passage:
      'People who use a meditation app report less stress. The company says the app reduces stress.',
    question: 'Which is the best alternative explanation?',
    options: [
      'People who choose to meditate may already handle stress differently',
      'Meditation is a modern trend',
      'The app has nice colours',
      'Stress cannot change',
    ],
    answer: 0,
    explanation:
      'Users choose themselves into the group. Without comparing with similar non-users, the app’s own effect is unclear.',
  },
];
