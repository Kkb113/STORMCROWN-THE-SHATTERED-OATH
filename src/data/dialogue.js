import { HERO_BY_ID } from './heroes.js';
import { storyCount } from '../game/progression.js';

export const CHOICES = {
  cathedral: {
    title:'Seventeen Stolen Years',
    speaker:'Nym',
    text:'Take the fragment, and seventeen years of trapped energy will strike everyone in the city. Leave it, and the falling kingdoms lose another chance. There is no painless answer.',
    options:[
      {id:'preserve',title:'Leave the fragment in the ward',text:'Preserve the people suspended in time. The later Crown campaign will face stronger storm hazards.',line:'Nym|They are not a price we get to decide someone else should pay.'},
      {id:'take',title:'Take the fragment',text:'The city’s stolen time is released. Gain Crown splinters, but carry this loss into the ending.',line:'Nym|I will remember every face. Someone must.'},
      {id:'mirrors',title:'Use the remaining mirrors',text:'A dangerous alternative discovered through Nym’s first companion quest. Share the discharge between the surviving wards.',requires:'nym1',line:'Nym|Mother taught me how to hold a moment. Perhaps she taught us more than that.'},
    ],
  },
  vex: {
    title:'A Knife Turned Inward',speaker:'Vex',
    text:'I sent the Empire our course. Before Stormreach. Before any of you knew my name. I cannot make that into something else. I can give you the codes that will stop the next transport.',
    options:[
      {id:'trust',title:'Let him earn a place here',text:'Trust becomes something Vex must build, not something Rael declares. Companion dialogue acknowledges the chance.',line:'Rael|Do not ask us to forget. Help us give those people a future.'},
      {id:'accountability',title:'Take the codes; demand the whole truth',text:'The crew accepts his help without absolution. His later companion missions become a promise to account for his actions.',line:'Brann|Every name. Every order. Then we get to work.'},
    ],
  },
  lucen: {
    title:'The Hand You Refuse to Lose',speaker:'Lucen',
    text:'Finish it. I gave the orders, Rael. I knew the names. Whatever comes next, do not pretend this makes me innocent.',
    options:[
      {id:'hand',title:'“I am not losing you twice.”',text:'Refuse the execution. Offer a hand, not forgiveness. Lucen joins the Warden as the eleventh anchor.',line:'Rael|Then live long enough to help the people your orders hurt.'},
    ],
  },
};
export function choiceOptions(kind,profile) {return (CHOICES[kind]?.options || []).map(o=>({...o,locked:!!o.requires&&!profile.completed.includes(o.requires)}));}

const TALKS = {
  rael: [
    ['Rael|Every time I close my eyes, I hear the west gate falling.', 'Brann|Then open them. There is still a ship full of people who need you.'],
    ['Rael|My mother knew what was inside me. She never called it a gift.', 'Nym|Perhaps she wanted you to choose what to call it.'],
    ['Rael|What do you do when the person you are fighting is right about the danger?', 'Mira|You stop pretending that being right excuses everything else.'],
    ['Rael|I used to think finding Lucen would put something back the way it was.', 'Sera|Nothing goes back. That does not mean nothing gets better.'],
    ['Rael|No one should have to hold the world alone.', 'Lucen|For once, little brother, we agree about the arithmetic.'],
  ],
  sera: [
    ['Sera|Brann offered to sharpen my blades.', 'Rael|That sounds kind.', 'Sera|He said I was ruining perfectly good steel. That was his version of kind.'],
    ['Sera|The orchards used to bloom through the ash. I thought that meant they could survive anything.', 'Rael|What will you plant when we go back?', 'Sera|Something stubborn.'],
    ['Sera|Lucen’s name is on those orders. Do not ask me to forget that.', 'Rael|I will not.', 'Sera|Good. That is a beginning.'],
    ['Sera|He asked me what forgiveness would look like.', 'Maelin|What did you tell him?', 'Sera|That he could start with the people still waiting to be found.'],
    ['Sera|Brann says there is a bottle aboard worth saving for the end of the world.', 'Rael|And after?', 'Sera|After sounds like an excellent reason to open it.'],
  ],
  brann: [
    ['Brann|The Warden has survived three wars and six captains.', 'Rael|Will it survive us?', 'Brann|I worry more about the furniture.'],
    ['Brann|You are getting better at looking behind you.', 'Rael|For enemies?', 'Brann|For the people following.'],
    ['Brann|A wall is only worth building when someone is behind it.', 'Mira|And when the wall is a person?', 'Brann|Then someone had better stand beside them.'],
    ['Brann|I was wrong about you, Rael.', 'Rael|Which part?', 'Brann|Do not make me list them. I am trying to be generous.'],
    ['Brann|Whatever happens up there, bring them home.', 'Rael|All of them.', 'Brann|That is the order.'],
  ],
  nym: [
    ['Nym|I have seen this conversation before.', 'Rael|How does it end?', 'Nym|You make a poor joke. Please surprise me.'],
    ['Nym|My mother used to say the future is a room with more than one door.', 'Oren|That is excellent safety planning.'],
    ['Nym|There are people beneath that ice. Not a city. People.', 'Mira|I know.', 'Nym|Then help me make sure we remember it when we decide.'],
    ['Nym|Torren is learning the old script.', 'Rael|How is it going?', 'Nym|He says our letters have too many dead branches.'],
    ['Nym|For the first time, I cannot see what comes next.', 'Rael|Are you afraid?', 'Nym|Yes. It is wonderful.'],
  ],
  vex: [
    ['Vex|There are at least four ways to board this ship unnoticed.', 'Brann|There were.'],
    ['Vex|Kes thinks I cheat at cards.', 'Rael|Do you?', 'Vex|Not enough to explain the losses.'],
    ['Vex|Being useful is not the same as being trusted.', 'Mira|No. But being honest is a place to start.'],
    ['Vex|Oren is building an engine with no master switch.', 'Rael|Does that worry you?', 'Vex|Only on behalf of every tyrant who will ever try to own it.'],
    ['Vex|I have nowhere else to be.', 'Kes|That is a terrible way to say you like us.', 'Vex|I am practicing.'],
  ],
  mira: [
    ['Mira|The ship has no chapel.', 'Brann|It has people who need protecting. Start there.'],
    ['Mira|I was taught to recognize corruption by its color.', 'Nym|That must have made sunsets difficult.'],
    ['Mira|Maelin spent an hour helping a spirit remember its daughter’s name.', 'Rael|And?', 'Mira|And I am reconsidering a great deal.'],
    ['Mira|Faith is not a law. I am learning the difference.', 'Maelin|You do not have to stop believing in the light to make room for someone in the dark.'],
    ['Mira|No one aboard this ship has to be pure to be worth saving.', 'Maelin|That may be the kindest prayer I have heard.'],
  ],
  torren: [
    ['Torren|This ship is made of dead trees.', 'Oren|And the determination of several very living people.'],
    ['Torren|Humans keep naming things they have not listened to.', 'Nym|Then teach me their older names.'],
    ['Torren|The forest has a long memory.', 'Rael|So do people.', 'Torren|Then perhaps we can stop pretending forgetting is the only way forward.'],
    ['Torren|Nym has asked me to write my name.', 'Brann|How did that go?', 'Torren|The paper is too small.'],
    ['Torren|There is room in the grove.', 'Rael|For whom?', 'Torren|That is the wrong first question.'],
  ],
  kes: [
    ['Kes|The important part of any bridge is the part you have not fallen off.', 'Brann|Do not teach Rael that.'],
    ['Kes|I drew the missing ships on a map so I would not forget to look.', 'Sera|You could have said you missed them.', 'Kes|The map has fewer opportunities to interrupt me.'],
    ['Kes|Vex is a terrible liar when he is trying to be honest.', 'Rael|Is that a compliment?', 'Kes|From me? Certainly.'],
    ['Kes|The Warden is on my map now.', 'Nym|What did you call it?', 'Kes|A very inconvenient place to leave.'],
    ['Kes|I found a route through the storm.', 'Rael|A safe one?', 'Kes|Let us celebrate one miracle at a time.'],
  ],
  oren: [
    ['Oren|I have improved the engines.', 'Brann|Are they quieter?', 'Oren|No. But now the alarming noise is intentional.'],
    ['Oren|The Crown’s circuits are restraints. Every scholar copied the same mistake.', 'Nym|A thousand years of certainty.', 'Oren|An expensive substitute for checking.'],
    ['Oren|Malthren’s calculations are correct.', 'Rael|Then calculate something else.', 'Oren|Yes. That is what I am trying to do.'],
    ['Oren|Eleven sources. Distributed load. No throne.', 'Vex|You make rebellion sound very tidy.', 'Oren|Good engineering often is.'],
    ['Oren|One person cannot carry it.', 'Rael|Then we change the number of people.', 'Oren|I rather hoped you would say that.'],
  ],
  maelin: [
    ['Maelin|The ship is full of voices.', 'Rael|Ghosts?', 'Maelin|Mostly Kes.'],
    ['Maelin|The dead are not always sad. Some are furious about unfinished arguments.', 'Sera|Understandable.'],
    ['Maelin|Mira asked whether the voices wanted to fight.', 'Rael|What did you tell her?', 'Maelin|That asking was a better beginning than deciding for them.'],
    ['Maelin|I have letters to deliver when this is over.', 'Mira|I will come with you.', 'Maelin|I know.'],
    ['Maelin|The choir is quiet tonight.', 'Rael|Is that good?', 'Maelin|They are listening to the living.'],
  ],
  lucen: [
    ['Lucen|You still leave your left side open.', 'Rael|You still begin conversations like a weapons instructor.'],
    ['Lucen|Malthren found me looking for you.', 'Rael|And told you I was dead.', 'Lucen|He told me a great many things.'],
    ['Lucen|I knew the names on those orders. I will not pretend otherwise.', 'Sera|Good. Keep going.'],
    ['Lucen|I do not know how to be your brother anymore.', 'Rael|Then we learn something neither of us already knows.'],
    ['Lucen|Seventeen years, little brother.', 'Rael|We are here now.', 'Lucen|Yes. We are.'],
  ],
};
export function companionTalk(profile,id) {
  const act=Math.min(4,Math.floor(storyCount(profile)/8));
  let lines=TALKS[id]?.[act] || [`${HERO_BY_ID[id]?.short || 'Crew'}|There is still work to do. We will do it together.`];
  if(id==='nym' && profile.choices.cathedral==='take')lines=['Nym|I remember the faces under the ice. I need you to remember them too.', 'Rael|I do. I will.', 'Nym|Then let them change what we do next.'];
  if(id==='vex' && profile.choices.vex==='accountability')lines=['Vex|Every name. Every order. I am writing them down.', 'Brann|And after?', 'Vex|After, I help the people who still have time.'];
  return lines;
}
export function endingLines(profile) {
  const city=profile.choices.cathedral;
  const lines=[
    ['THE SHATTERED OATH','The islands stopped falling. Not because a king had commanded them to rise, but because eleven people had agreed to share their weight.'],
    ['STORMREACH','The lightning towers were rebuilt. Their keepers began to hear the same note again. On the western gate, someone carved the names of the people who had held the road.'],
    ['CINDERFALL','The pressure locks came down. Sera returned to a ridge where the orchards had been. She planted something stubborn.'],
    ['THE WHITE CATHEDRAL',city==='mirrors'?'The mirrors held. Across the city, unfinished heartbeats found their next moments. A child finally reached her mother’s hand.':city==='take'?'The stolen hour ended. Nym returned to a city of silence and wrote down every name she could find. The world was saved. Its cost was not forgotten.':'The central ward remained. With the Crown’s load shared, the crew could return to the unfinished hour without an Emperor at their heels. Nym began the patient work of waking her people.'],
    ['THE VERDANT MAW','The World Beast rested beside the new grove. Torren made room for refugees, and taught them which roots could bear a home. The forest remembered. It also grew.'],
    ['THE CROWN ABOVE','There was no new throne. The life engines were dismantled. Their conduits became hospitals, bridges, and things their first makers had never been allowed to imagine.'],
    ['THE WARDEN',profile.completed.filter(id=>/2$/.test(id)&&!/[scwva]\d/.test(id)).length>=7?'At first they had sat alone. Now there were cards on Vex’s table, writing lessons at Nym’s, and an argument over who had opened Brann’s bottle. At the prow, two brothers watched the storm without needing to fill the silence.':'The Warden carried its crew between the kingdoms. There were still names to find, wrongs to face, and conversations not yet finished. This time, they had chosen to stay.'],
    ['ELEVEN ORDINARY PEOPLE','Flame. Frost. Earth. Nature. Light. Shadow. Spirit. Wind. Arcane. Void. Storm.\n\nNot a crown. An oath.'],
  ];
  return lines;
}
