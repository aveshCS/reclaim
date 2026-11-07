/**
 * Reading-stamina passages. Original text written for RECLAIM (draft, self-checked).
 * The passage is hidden before questions, so answers come from memory and understanding.
 */

export type PassageQuestion = {
  question: string;
  options: string[];
  answer: number;
};

export type Passage = {
  id: string;
  title: string;
  text: string;
  questions: PassageQuestion[];
};

export const PASSAGES: Passage[] = [
  {
    id: 'rd-01',
    title: 'The bamboo that waits',
    text: 'Some species of bamboo spend years growing almost nothing above the ground. During that time, the plant builds a deep and wide network of roots. Then, once the roots are ready, the shoots can grow remarkably fast, sometimes close to a metre in a single day. Gardeners who give up in the early years never see this burst. The slow years are not wasted; they are when the real foundation is built.',
    questions: [
      {
        question: 'What happens during the early years?',
        options: [
          'The plant builds its roots',
          'The plant grows a metre a day',
          'The plant flowers',
          'The plant is dormant and does nothing',
        ],
        answer: 0,
      },
      {
        question: 'What is the main point of the passage?',
        options: [
          'Slow early progress can build the base for later growth',
          'Bamboo is the tallest plant',
          'Gardeners should avoid bamboo',
          'Roots are more beautiful than shoots',
        ],
        answer: 0,
      },
      {
        question: 'How fast can some shoots grow once ready?',
        options: [
          'Close to a metre in a day',
          'A centimetre a year',
          'A metre a month',
          'The passage does not say',
        ],
        answer: 0,
      },
    ],
  },
  {
    id: 'rd-02',
    title: 'Why we forget names',
    text: 'Many people say they are "bad with names", but often the name was never stored properly in the first place. When we meet someone, our attention is busy: we are thinking about what to say, how we look, or what is happening around us. The name passes by without being processed. A simple fix is to repeat the name once, out loud or silently, and link it to something about the person. Paying attention for those few seconds makes a large difference.',
    questions: [
      {
        question: 'According to the passage, why do we often forget names?',
        options: [
          'The name was not properly stored in the first place',
          'Our memory gets weaker with age',
          'Names are too long',
          'We meet too many people',
        ],
        answer: 0,
      },
      {
        question: 'Which fix does the passage suggest?',
        options: [
          'Repeat the name and link it to something about the person',
          'Write every name in a notebook',
          'Avoid meeting new people',
          'Ask the person to spell their name',
        ],
        answer: 0,
      },
      {
        question: 'What keeps our attention busy when meeting someone?',
        options: [
          'Thinking about what to say and how we look',
          'Looking at our phone',
          'Trying to remember their face',
          'The passage does not say',
        ],
        answer: 0,
      },
    ],
  },
  {
    id: 'rd-03',
    title: 'The kettle that never boils',
    text: 'There is an old saying that a watched pot never boils. Of course, it does boil; it just feels slower when we stare at it. Time seems to stretch when we are waiting and checking. Researchers have found that people who check repeatedly for an expected event often judge the wait as longer than it really was. The same thing can happen when we refresh a feed for something new: the constant checking itself makes waiting feel heavier.',
    questions: [
      {
        question: 'What does the saying really describe?',
        options: [
          'Waiting feels longer when we keep watching',
          'Pots cannot boil while observed',
          'Boiling water is dangerous',
          'Kettles are slow',
        ],
        answer: 0,
      },
      {
        question: 'What link does the passage make to feeds?',
        options: [
          'Constant checking can make waiting feel heavier',
          'Feeds load faster when watched',
          'Feeds are like kettles',
          'Refreshing saves time',
        ],
        answer: 0,
      },
      {
        question: 'How do people who check repeatedly judge the wait?',
        options: [
          'As longer than it really was',
          'As shorter than it really was',
          'Accurately',
          'They do not notice it',
        ],
        answer: 0,
      },
    ],
  },
  {
    id: 'rd-04',
    title: 'Two kinds of rest',
    text: 'Not all breaks recharge us equally. Scrolling through short videos may feel like a break, but it keeps the mind busy switching between new things. A quieter break, such as a short walk, looking out of a window, or simply doing nothing for a few minutes, gives attention a real pause. Many people return from these quiet breaks feeling clearer, even though they seem less exciting at first.',
    questions: [
      {
        question: 'Why might scrolling not feel restful?',
        options: [
          'It keeps the mind switching between new things',
          'Screens are too bright',
          'Videos are too long',
          'It uses too much battery',
        ],
        answer: 0,
      },
      {
        question: 'Which is given as a quieter break?',
        options: [
          'Looking out of a window',
          'Watching a film',
          'Checking messages',
          'Playing a fast game',
        ],
        answer: 0,
      },
      {
        question: 'How do quiet breaks seem at first?',
        options: [
          'Less exciting',
          'More exciting',
          'Stressful',
          'Exactly like scrolling',
        ],
        answer: 0,
      },
    ],
  },
  {
    id: 'rd-05',
    title: 'The Zeigarnik note',
    text: 'Unfinished tasks tend to stay on our minds. A half-written email or a forgotten errand can keep popping up while we try to focus on something else. One helpful habit is to write a quick note about the next step of any unfinished task before switching. Once the plan is on paper, the mind often lets go of it more easily, freeing attention for the task at hand.',
    questions: [
      {
        question: 'What tends to stay on our minds?',
        options: [
          'Unfinished tasks',
          'Finished tasks',
          'Old memories',
          'Long emails',
        ],
        answer: 0,
      },
      {
        question: 'What habit does the passage suggest?',
        options: [
          'Write down the next step before switching tasks',
          'Never start new tasks',
          'Finish everything before resting',
          'Delete unfinished emails',
        ],
        answer: 0,
      },
      {
        question: 'Why does the habit help?',
        options: [
          'The mind can let go once the plan is written',
          'Writing is faster than thinking',
          'Paper is better than phones',
          'It makes tasks shorter',
        ],
        answer: 0,
      },
    ],
  },
  {
    id: 'rd-06',
    title: 'The sailor’s horizon',
    text: 'Sailors who feel seasick are often told to look at the horizon. Watching a steady, distant point helps the brain match what the eyes see with what the body feels. In a similar way, keeping one clear goal in view can steady a busy day. When many small tasks pull us in different directions, returning to that one goal gives our attention something stable to rest on.',
    questions: [
      {
        question: 'Why are seasick sailors told to look at the horizon?',
        options: [
          'It helps the brain match sight with body movement',
          'The horizon is beautiful',
          'It makes the ship slower',
          'It helps them see land',
        ],
        answer: 0,
      },
      {
        question: 'What is the "horizon" compared to in daily life?',
        options: [
          'One clear goal',
          'A long holiday',
          'A to-do list with many items',
          'A phone screen',
        ],
        answer: 0,
      },
      {
        question: 'What pulls our attention in different directions?',
        options: [
          'Many small tasks',
          'The weather',
          'Long meetings only',
          'The passage does not say',
        ],
        answer: 0,
      },
    ],
  },
];
