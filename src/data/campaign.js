import { HEROES } from './heroes.js';
import { REGIONS } from './regions.js';

/** Authored mission graphs. A stage is an actual traversable encounter space. */
const stage = text => { const [type, title, param] = text.split('|'); return { type, title, param }; };
function mission(id, title, region, theme, layout, stages, brief, intro, outro, extra = {}) {
  return { id, title, region, theme, layout, stages: stages.map(stage), brief, intro, outro, ...extra };
}
const M = mission;
export const CAMPAIGN = [
  M('s01', 'The Night of Thunder', 0, 'bastion', 'procession', [
    'fight|The Western Gate', 'rescue|Civilians in the Rain', 'defend|The Last Lightning Tower', 'boss|The Courtyard Burns|warengine',
  ], 'Imperial airships have crossed the stormwall. Hold the western quarter long enough for the civilians to reach the Warden.',
  ['Rael|That is not thunder. Those are siege guns.', 'Brann|West gate. Keep the evacuation lane open. Sera, with me.', 'Sera|I do not take orders from— Fine. We argue when they are safe.'],
  ['Rael|The lightning… it went through me. I can still feel it.', 'Sera|You tore a war engine in half. What are you?', 'Rael|I was hoping one of you knew.'], { tutorial: true, cinematic: 'awakening' }),
  M('s02', 'A Bridge for the Living', 0, 'bridges', 'switchback', [
    'rescue|The Eastern Refuge', 'escort|Across the Broken Span', 'sabotage|Imperial Signal Flares', 'fight|The Bridge Captain', 'escape|The Warden’s Mooring',
  ], 'The eastern skybridge is the only route out of the city. Bring its refugees through before Imperial spotters mark the Warden.',
  ['Brann|A soldier’s first duty is not to win. It is to bring people home.', 'Rael|Then why are we leaving our home behind?', 'Brann|Because they are still in it.'],
  ['Refugee|My daughter is aboard. I thought… Thank you.', 'Brann|Remember her face, Rael. That is what a victory looks like.']),
  M('s03', 'The Bell That Would Not Break', 0, 'chapel', 'cloister', [
    'fight|The Bellmaker’s Steps', 'relay|The Three Grounding Runes', 'rescue|The Oracle in the Vault', 'defend|An Unfinished Prophecy', 'escape|The Flooded Cloister',
  ], 'A frost-wielder is trapped beneath the bell tower. Reach her before the Empire finds another living source of elemental power.',
  ['Nym|You are late. In the other futures, you were dead.', 'Rael|I will try not to take that personally.', 'Nym|Please do. Personal things are the only things that change a future.'],
  ['Nym|There is a shard inside your heart. Your mother hid you from the Crown.', 'Rael|My mother died during Crownfall.', 'Nym|I know. I am sorry.'], { unlockHero: 'nym' }),
  M('s04', 'Under Black Banners', 0, 'streets', 'crossroads', [
    'sabotage|The Imperial Landing Beacons', 'fight|A Street Without Doors', 'rescue|The Prisoners’ Square', 'relay|Open the Storm Sluices', 'fight|Tempest Knight Detachment',
  ], 'Imperial troops are taking elemental wielders alive. Destroy their landing beacons and open an escape through the rain sluices.',
  ['Sera|They took people like this in Cinderfall. Cages. Names on lists.', 'Nym|Do you know where they sent them?', 'Sera|No. But I remember every officer who signed the orders.'],
  ['Rael|Malthren is not conquering this city. He is searching it.', 'Nym|For the same thing he will find when he looks at you.']),
  M('s05', 'The Archive of Rain', 0, 'archive', 'cloister', [
    'fight|The Scribes’ Hall', 'collect|Three Crownfall Ledgers', 'relay|The Archivist’s Lock', 'defend|A Memory Under Siege', 'escape|The Burning Stacks',
  ], 'The city’s oldest archive contains maps to five Crownfall impact sites. Recover the ledgers before the Empire burns its mistakes.',
  ['Nym|These records are older than the kingdoms.', 'Brann|And guarded by soldiers younger than the lies.', 'Rael|Then we take the records. Not their lives, unless we have to.'],
  ['Nym|Five fragments. Five primal forces. And all five kingdoms buried what they knew.', 'Rael|Then we dig it up.']),
  M('s06', 'A Knife in the Gale', 0, 'rooftops', 'switchback', [
    'fight|The Rooftop Ambush', 'rescue|The Man Without a Banner', 'sabotage|The Pursuers’ Signals', 'escort|A Dangerous Witness', 'fight|The Silent Captain',
  ], 'An Imperial courier offers a route through the occupation. His name is Vex Talon. Brann advises against trusting him.',
  ['Vex|I have a map, three stolen orders, and a very short life expectancy.', 'Brann|Traitors usually do.', 'Vex|Then let us make the most of mine.'],
  ['Vex|Malthren’s operation has a name. The Ascension.', 'Sera|Everything sounds cleaner when you give it a name.'], { unlockHero: 'vex' }),
  M('s07', 'The Mask in the Storm', 0, 'stormwall', 'procession', [
    'sabotage|The Grounding Chains', 'fight|Knights of the Ascension', 'relay|The Stormwall Circuit', 'defend|A Blade Remembered', 'escape|Leave the Tower Behind',
  ], 'The stormwall can conceal the Warden’s escape. Reach its control spire. An Imperial warrior in a silver mask is already waiting.',
  ['Masked Warden|You do not understand what you carry.', 'Rael|Then stop trying to kill me and explain it.', 'Masked Warden|I was not trying.'],
  ['Rael|That turn of the spear. Lucen taught me—', 'Brann|Your brother died seventeen years ago.', 'Rael|I know. I know.']),
  M('s08', 'A Heart of Thunder', 0, 'arena', 'citadel', [
    'fight|The Ruined Processional', 'relay|The Colossus Wakes', 'sabotage|Break Its Grounding Seals', 'boss|The Thunder Colossus|colossus', 'oath|The First Fragment',
  ], 'The Crown fragment at the heart of Stormreach has awakened its armored jailer. Turn the storm against the Thunder Colossus.',
  ['Nym|The lightning is feeding it.', 'Rael|Then I take the lightning first.', 'Brann|That is the worst plan I have ever agreed to.'],
  ['Rael|One fragment. Four more kingdoms.', 'Nym|And less than a year before they fall.', 'Sera|Then point the ship toward Cinderfall.'], { fragment: 'storm', checkpointBoss: true }),

  M('c01', 'Ash on the Horizon', 1, 'ashport', 'crossroads', [
    'fight|The Cinder Docks', 'rescue|The Last Ferry', 'relay|The Furnace Gates', 'defend|A Refuge Beneath the Mountain', 'escape|Beyond the Ash Curtain',
  ], 'The Warden reaches Cinderfall through an ash storm. Imperial engineers have sealed the mountain’s pressure vents.',
  ['Sera|There used to be orchards on that ridge.', 'Rael|Sera…', 'Sera|Do not apologize for someone else. Help me make them stop.'],
  ['Brann|The vents were sealed from the inside.', 'Sera|They are making the volcano erupt. Deliberately.']),
  M('c02', 'The Thief of Updrafts', 1, 'cliffs', 'switchback', [
    'fight|The Hanging Market', 'escort|A Hunter’s Shortcut', 'sabotage|The Sky Reavers’ Nests', 'rescue|The Windrider’s Crew', 'fight|The Crimson Lookout',
  ], 'A sky-hunter named Kes has been stealing Imperial supply routes. Find the hunter before a squadron of Sky Reavers does.',
  ['Kes|That bridge is technically still a bridge.', 'Brann|Half of it is in the lava.', 'Kes|The important half is the one we are on.'],
  ['Kes|Your ship needs a scout. My ship needs to have not exploded. We can help each other.', 'Sera|Welcome aboard. Do not steal anything important.'], { unlockHero: 'kes' }),
  M('c03', 'The City Under Chains', 1, 'temples', 'cloister', [
    'sabotage|Three Chains of Occupation', 'rescue|The Furnace Workers', 'fight|The Ash Brutes’ March', 'relay|Release the Pressure Lock', 'defend|The Open Vent',
  ], 'The furnace districts are chained shut with their workers still inside. Break the locks and vent the mountain without flooding the streets.',
  ['Sera|I learned to fight here. On these steps.', 'Rael|Who taught you?', 'Sera|People the Empire decided the mountain could spare.'],
  ['Worker|The foundry master stayed behind. He is trying to shut the engine down.', 'Sera|Oren Vox. Of course he is.']),
  M('c04', 'The Runesmith’s Equation', 1, 'foundry', 'crossroads', [
    'fight|The Engine Hall', 'relay|Match the Runic Regulators', 'defend|Oren’s Impossible Repair', 'sabotage|The Imperial Overload', 'escape|The Foundry Lift',
  ], 'Oren Vox has turned an Imperial extraction engine against its owners. Keep him alive long enough to prove his mathematics.',
  ['Oren|Good news: the engine can be stopped.', 'Brann|And the bad news?', 'Oren|Someone has installed the engine inside a volcano. Poor design.'],
  ['Oren|The Crown is not a machine. These circuits look more like restraints.', 'Nym|Then what were they restraining?'], { unlockHero: 'oren' }),
  M('c05', 'Names in the Furnace', 1, 'prison', 'cloister', [
    'rescue|The Numbered Cells', 'collect|The Transport Registers', 'fight|The Warden’s Guard', 'escort|The Uncounted', 'defend|The Last Prison Door',
  ], 'Sera recognizes the prison commandant’s seal. Recover the transport registers and free the people whose names he erased.',
  ['Sera|I know that seal.', 'Vex|We need the records more than we need revenge.', 'Sera|You do not get to tell me what I need.'],
  ['Sera|Lucen Corven. His name is on the orders.', 'Rael|That is impossible.', 'Sera|So was surviving a lightning bolt.']),
  M('c06', 'Down the Mountain', 1, 'descent', 'descent', [
    'sabotage|The Failing Lift', 'escape|The First Lava Front', 'rescue|The Broken Cable Station', 'escape|The Collapsing Pilgrim Road', 'fight|The Last Cool Stone',
  ], 'The upper caldera is collapsing. Descend through the pilgrim road while lava consumes the route behind you. No one gets left on the mountain.',
  ['Kes|I found us a way down.', 'Oren|Is it the road currently falling down?', 'Kes|It will be a very efficient descent.'],
  ['Sera|You went back for them.', 'Rael|So would you.', 'Sera|Before today? I do not know.']),
  M('c07', 'Beneath the Black Temple', 1, 'temple', 'citadel', [
    'relay|The Three Ashen Vows', 'fight|The Temple’s Hollow Priests', 'collect|A Record of the First Crown', 'sabotage|The Ember Seals', 'defend|The Descent Opens',
  ], 'An ancient temple stands below the magma line. Its inscriptions predate the Empire and describe the Crown as a cage.',
  ['Nym|The inscription says “Do not wake the bearer.”', 'Oren|That is an unusually personal warning for a power source.', 'Vex|We should leave. Now.'],
  ['Rael|You knew something was alive inside it.', 'Vex|I knew there were records I was never allowed to read.']),
  M('c08', 'What the Fire Keeps', 1, 'caldera', 'arena', [
    'fight|The Obsidian Causeway', 'sabotage|The Four Furnace Hearts', 'boss|The Ash King|ashking', 'oath|The Ember Fragment',
  ], 'The Ash King guards the fragment in a rising sea of fire. His armor is melting. So is the floor beneath your feet.',
  ['Ash King|Everything burns. Even the names you came to save.', 'Sera|Then I will say them louder.', 'Rael|Sera. We do this together.'],
  ['Sera|I thought revenge would feel like a door opening.', 'Rael|What does it feel like?', 'Sera|A room I do not have to stay in anymore.'], { fragment: 'fire', checkpointBoss: true }),

  M('w01', 'A Country Without Footsteps', 2, 'frozenstreets', 'procession', [
    'fight|The Snowbound Gate', 'collect|The Silent Watch', 'rescue|The Sun Knight', 'relay|A Light in the Ice', 'escape|The Cathedral Approach',
  ], 'A city stands perfectly still beneath the ice. Mira Solenne, a knight of its surviving order, refuses to let gravebinders enter.',
  ['Mira|No Void-touched thing passes this gate.', 'Vex|That is going to make this introduction awkward.', 'Nym|These people are not dead. Let us through.'],
  ['Mira|There has been no heartbeat here for seventeen years.', 'Nym|There has been one heartbeat. It has not finished yet.'], { unlockHero: 'mira' }),
  M('w02', 'The Clockwork of Grief', 2, 'clocktower', 'cloister', [
    'relay|The Clockmaker’s First Hour', 'fight|Echoes of the Guard', 'relay|The Hour That Never Came', 'collect|Three Stasis Readings', 'defend|The Frozen Pendulum',
  ], 'Measure the city’s stasis field. Its clocks disagree with one another, but each one remembers a different moment of Crownfall.',
  ['Oren|The temperature is impossible, but the time differential is worse.', 'Nym|Speak plainly.', 'Oren|If we remove the fragment, seventeen years arrive at once.'],
  ['Mira|Can they survive that?', 'Oren|Not without someone holding the years back.', 'Nym|Then someone will.']),
  M('w03', 'A Voice Beneath the Glass', 2, 'crypt', 'crossroads', [
    'fight|The Glass Catacombs', 'collect|The Unspoken Names', 'rescue|A Gravebinder’s Vigil', 'defend|The Choir’s Sanctuary', 'relay|The Door of Mourning',
  ], 'A woman is speaking with voices beneath the ice. Maelin Dray believes they can hear her. Mira believes she should be executed.',
  ['Mira|That is forbidden magic.', 'Maelin|Then forbid it after these children stop being afraid.', 'Nym|Mira. Lower your spear.'],
  ['Maelin|They know the city is still here. They are waiting for someone to come back.', 'Mira|What did they call you?', 'Maelin|Kind. It surprised me too.'], { unlockHero: 'maelin' }),
  M('w04', 'The Weight of a Second', 2, 'observatory', 'citadel', [
    'relay|The Constellation Lock', 'fight|The Crown’s Reflections', 'sabotage|Imperial Survey Beacons', 'collect|The Descent Calculations', 'defend|The Last Reading',
  ], 'The observatory has measured Aetherra’s descent since Crownfall. Its last calculation will change what the party is fighting for.',
  ['Oren|I have checked it six times.', 'Rael|Check it again.', 'Oren|Rael. Malthren is telling the truth. Without the Crown, every kingdom falls.'],
  ['Brann|Two million lives for everyone else. That is his arithmetic.', 'Rael|Then we find something he did not count.', 'Nym|We find another answer.']),
  M('w05', 'The Mercy of Winter', 2, 'sanctuary', 'crossroads', [
    'rescue|The Trapped Pilgrims', 'relay|The Western Time Ward', 'defend|The Eastern Time Ward', 'sabotage|The Imperial Siphons', 'collect|The Children’s Garden',
  ], 'Stabilize the outer time wards before reaching the fragment. Every ward preserved is a district that may yet have a tomorrow.',
  ['Mira|I swore to protect this city. Not to decide which parts of it deserved saving.', 'Maelin|Then do not decide. Start with the person nearest you.'],
  ['Nym|I remember this garden. My mother brought me here.', 'Rael|We will bring you both back.']),
  M('w06', 'The Daughter Returns', 2, 'cathedral', 'procession', [
    'fight|The Nave of Still Voices', 'relay|Avel’s Three Prayers', 'collect|The Oracle’s Last Letter', 'defend|A Door in the Ice', 'fight|The Choir of Shards',
  ], 'Nym’s mother waits in the heart of the White Cathedral. The letter she left seventeen years ago was written to a daughter already grown.',
  ['Nym|She knew I would come.', 'Rael|You said personal things change a future.', 'Nym|I am trying very hard to believe myself.'],
  ['Saint Avel|Nym? You were so small.', 'Nym|I know, Mother. I know.']),
  M('w07', 'Saint of the Stolen Hour', 2, 'icearena', 'arena', [
    'relay|Break the Mirror Wards', 'fight|The Saint’s Frozen Echoes', 'boss|Saint Avel|saint', 'oath|A Daughter’s Goodbye',
  ], 'The Crown has made Saint Avel the guardian of a frozen instant. Survive the stolen hours without letting the fragment take Nym with her.',
  ['Saint Avel|I held it. I held the whole city. Is the war over?', 'Nym|Not yet.', 'Saint Avel|Then let go of my hand, little star. You will need both of yours.'],
  ['Nym|I saw a hundred endings. None of them taught me how to say goodbye.', 'Maelin|You do not have to finish saying it today.'], { checkpointBoss: true }),
  M('w08', 'Tomorrow Is Not Free', 2, 'timevault', 'cloister', [
    'relay|The Failing Stasis Network', 'defend|A City Between Heartbeats', 'sabotage|The Imperial Extraction Rig', 'choice|The Price of Tomorrow|cathedral', 'escape|The Last White Bridge',
  ], 'The fragment cannot remain untouched. Choose whether to hold the city in stasis until another answer is found, or awaken it now at a terrible cost.',
  ['Mira|There is no clean choice here.', 'Oren|We can keep the wards alive. But holding them drains power from the other islands.', 'Rael|Or we wake them, and ask them to survive seventeen years in a moment.'],
  ['Rael|No king gets to make this choice alone. Not even one who thinks he means well.', 'Nym|Then remember that. At the end, remember.'], { fragment: 'frost', choice: 'cathedral' }),

  M('v01', 'The Forest Has Teeth', 3, 'forest', 'crossroads', [
    'fight|The Overgrown Landing', 'relay|The Living Paths', 'rescue|A Hunter’s People', 'defend|The Rootbound Refuge', 'escape|An Unwelcome Invitation',
  ], 'The Verdant Maw has swallowed an ancient floating city. Torren Fen considers the invading Empire and your expedition equally unwelcome.',
  ['Torren|Your kingdoms tore the heart out of this forest. Why would I save them?', 'Rael|Because your forest falls with them.', 'Torren|An honest threat. That is new.'],
  ['Torren|You stayed when you could have left.', 'Brann|There were people behind us.', 'Torren|My people. Remember that.'], { unlockHero: 'torren' }),
  M('v02', 'The City in the Roots', 3, 'ruins', 'cloister', [
    'collect|The Buried Council Chamber', 'fight|The Harvesters’ Machines', 'sabotage|Three Dead Extraction Wells', 'relay|The First Kingdom’s Seal', 'defend|What the Earth Remembers',
  ], 'The ruins reveal that the kingdoms were extracting Crown energy long before Crownfall. The catastrophe was not an accident.',
  ['Oren|Every kingdom signed the extraction charter.', 'Torren|My people were not asked.', 'Mira|Neither were the people who died when the cities fell.'],
  ['Rael|Malthren inherited a disaster. He did not invent it.', 'Sera|That does not make what he is doing right.']),
  M('v03', 'A Traitor at the Table', 3, 'imperialcamp', 'crossroads', [
    'sabotage|The Hidden Imperial Relay', 'collect|Vex’s Unsent Reports', 'fight|The Retrieval Detachment', 'choice|A Knife Without an Owner|vex', 'escort|The Long Way Back',
  ], 'An Imperial signal carries a voice you recognize. Vex has been reporting on the party. He says he stopped. Decide what trust costs now.',
  ['Vex|I was sent to bring Rael to the Emperor.', 'Sera|And the rest of us?', 'Vex|Expendable. That is the word he used. It is not the word I use anymore.'],
  ['Brann|Trust is work, Talon. You do not get to ask for it and be done.', 'Vex|Then give me something to do.'], { choice: 'vex' }),
  M('v04', 'The Hunt That Turned', 3, 'wilds', 'switchback', [
    'collect|The World Beast’s Tracks', 'fight|The Hollowed Herd', 'escape|Through the Moving Forest', 'boss|The World Beast|worldbeast', 'oath|A Guardian’s Wound',
  ], 'Track the colossal beast that guards the fragment. The hunt will take you across broken districts—and toward the thing it was protecting you from.',
  ['Torren|It is not running from us.', 'Kes|Then what are those wounds?', 'Torren|It has been fighting something beneath the roots. For years.'],
  ['Rael|We came here to kill the guardian.', 'Torren|You stopped. That matters.', 'Nym|Something below us did not.']),
  M('v05', 'No Roots in Heaven', 3, 'heartwood', 'citadel', [
    'sabotage|The Corrupted Root Hearts', 'rescue|The Buried Grove', 'defend|The World Beast’s Last Stand', 'boss|The Rootless God|rootless', 'oath|The Living Fragment',
  ], 'The Rootless God rises through the entire city. Fight upon its moving body while the World Beast holds its jaws apart.',
  ['Torren|The ground is breathing.', 'Brann|Then we break its teeth before it decides to bite.', 'Maelin|The dead beneath this city are with us. All of them.'],
  ['Torren|The forest will remember this too.', 'Rael|What will it remember?', 'Torren|That once, people came to give something back.'], { fragment: 'earth', checkpointBoss: true }),
  M('v06', 'The Emperor’s Children', 3, 'skyprison', 'procession', [
    'rescue|The Ascension Transports', 'sabotage|The Life-Engine Manifolds', 'collect|The Sacrifice Census', 'defend|The Civilian Hangar', 'escape|An Imperial Spear',
  ], 'Malthren’s sacrifice census includes entire civilian populations. The masked Warden finds his name beside orders he never gave.',
  ['Lucen|These are not soldiers.', 'Malthren|No. They are the price of every soldier, every child, every kingdom that survives.', 'Lucen|You told me there was a line we would not cross.'],
  ['Rael|Take off the mask.', 'Lucen|You should have stayed dead to me, little brother.', 'Rael|I was going to say the same thing.']),
  M('v07', 'Brothers of the Storm', 3, 'stormduel', 'arena', [
    'relay|The Splintered Stormwall', 'fight|A Path Through the Tempest', 'boss|Lucen Corven|lucen', 'choice|The Hand You Refuse to Lose|lucen',
  ], 'Rael faces his brother in an electrical storm. There is no army between them now. Only seventeen years and a choice.',
  ['Lucen|You think kindness changes the arithmetic.', 'Rael|No. I think you stopped looking for another answer.', 'Lucen|Then make me look.'],
  ['Lucen|Finish it.', 'Rael|No.', 'Lucen|Rael—', 'Rael|I am not losing you twice.'], { solo: 'rael', unlockHero: 'lucen', choice: 'lucen', checkpointBoss: true }),
  M('v08', 'The Warden Turns', 3, 'skybridge', 'switchback', [
    'defend|The Brothers’ Crossing', 'sabotage|Four Imperial Storm Towers', 'escort|The Last Defectors', 'fight|Knights Without a Warden', 'escape|The Path Above the Clouds',
  ], 'Lucen knows a route to the Crown Above. The Empire knows he has betrayed it. Bring his defectors and the Warden through the stormwall.',
  ['Sera|I have not forgiven you.', 'Lucen|You should not have to.', 'Sera|But I am not letting Malthren decide what your life is worth either.'],
  ['Brann|Eleven of us. Five kingdoms behind us.', 'Rael|Then we go together.', 'Lucen|This time, I am not leaving you.']),

  M('a01', 'The War Below', 4, 'warfront', 'crossroads', [
    'defend|The Stormreach Landing', 'rescue|The Cinderfall Vanguard', 'relay|The Cathedral Shield Line', 'sabotage|The Imperial Sky Batteries', 'escape|The Crown’s Outer Wall',
  ], 'The five kingdoms rise together beneath a falling sky. Hold their landing grounds and open the assault on Malthren’s city.',
  ['Kes|I can see islands falling through the clouds.', 'Nym|Do not look down.', 'Rael|Look at the person beside you. Keep moving.'],
  ['Mira|The kingdoms are fighting together.', 'Brann|About seventeen years late.', 'Rael|Not too late. Not yet.']),
  M('a02', 'Eleven Against a Kingdom', 4, 'goldcity', 'procession', [
    'fight|The Black-and-Gold Avenue', 'sabotage|The Crown Guardians’ Seals', 'rescue|The Imperial Families', 'defend|The Warden Under Fire', 'relay|The Palace Approaches',
  ], 'Shardborn have breached the capital. Imperial families are trapped between their own soldiers and the Crown’s monsters.',
  ['Sera|Their banners are over those houses.', 'Lucen|Their children are under them.', 'Sera|I know. Lead the way.'],
  ['Lucen|Thank you.', 'Sera|Do not make me regret it.', 'Lucen|I intend to spend a long time trying not to.']),
  M('a03', 'The Ascension Engine', 4, 'engine', 'cloister', [
    'relay|The Five Living Circuits', 'sabotage|The Northern Life Siphons', 'defend|Oren and the Impossible Number', 'sabotage|The Southern Life Siphons', 'fight|The Engine’s Custodians',
  ], 'Destroy the engines built to harvest two million lives. Oren needs the living circuits intact if another answer is to remain possible.',
  ['Oren|Do not smash the blue conduits.', 'Brann|I was going to smash all of the conduits.', 'Oren|An understandable first draft. Let us improve it.'],
  ['Oren|The Crown does not require one source. It can divide the load.', 'Nym|How many sources?', 'Oren|More than one person could survive.']),
  M('a04', 'The Records Were Wrong', 4, 'archive', 'citadel', [
    'collect|The First Emperor’s Confession', 'relay|The Prisoner’s Name', 'fight|The Hollow Imperial Court', 'collect|The Anchor Equation', 'escape|A Storm Inside the Walls',
  ], 'The palace archive contains the first Crown’s true purpose. It was not built to rule the sky. It was built to imprison something in it.',
  ['Maelin|Astra Veyr. The Living Storm.', 'Nym|They made a world depend on the life of a prisoner.', 'Rael|And called the prison a crown.'],
  ['Lucen|Malthren does not know.', 'Vex|He knows everything he thinks he needs to know.', 'Rael|Then we get there before he finds out the rest.']),
  M('a05', 'The Last Gate', 4, 'palace', 'procession', [
    'fight|The Hall of Five Kingdoms', 'relay|The Oaths the Empire Broke', 'defend|The Last Allied Line', 'boss|The Crownless Warden|warden', 'oath|Before the Throne',
  ], 'The palace’s oldest guardian keeps an oath to a ruler no one remembers. Beyond it, Malthren is already rebuilding the Crown.',
  ['Brann|Everyone still here?', 'Kes|Against all reasonable expectations.', 'Rael|Then this is the last door we open alone.'],
  ['Nym|In my visions, you destroyed Aetherra.', 'Rael|What do you see now?', 'Nym|Nothing. For the first time, I do not know.']),
  M('a06', 'The Price of a World', 4, 'throne', 'arena', [
    'relay|The Five Crown Fragments', 'fight|The Ascension Honor Guard', 'boss|Emperor Malthren Vane|malthren', 'oath|A Crown Reassembled',
  ], 'Malthren fights with all five primal forces. Stop the Ascension without destroying the one thing still holding Aetherra above the storm.',
  ['Malthren|I have counted every life this will cost. Have you counted the lives your refusal will cost?', 'Rael|I have stopped pretending they are only numbers.', 'Malthren|Then show me a better answer.'],
  ['Malthren|The records… The Crown was never the source.', 'Oren|It was the lock.', 'Astra Veyr|I REMEMBER THE SKY.'], { checkpointBoss: true }),
  M('a07', 'Crownfall', 4, 'collapse', 'descent', [
    'escape|The Throne Falls Away', 'defend|A Bridge Made of Oaths', 'rescue|The Emperor’s Last Guard', 'escape|Islands in the Living Storm', 'relay|The Eleven Paths',
  ], 'The fortress breaks apart around you. Reach the shattered Crown while Astra Veyr tears its prison out of the sky.',
  ['Malthren|I was going to save them.', 'Rael|Then help us.', 'Lucen|Rael. The bridge.', 'Rael|All of us. Now.'],
  ['Oren|Eleven sources. The load might hold.', 'Mira|Might?', 'Oren|For once, I am choosing to be optimistic.']),
  M('a08', 'The Shattered Oath', 4, 'livingstorm', 'finale', [
    'defend|The First Anchor', 'relay|The Hands of the Storm', 'boss|Astra Veyr, the Living Storm|astra', 'anchors|Eleven Ordinary People',
  ], 'Kill the Living Storm and every island falls. Imprison it and millions die. Refuse both. Share the weight of the world.',
  ['Astra Veyr|ANOTHER CROWN. ANOTHER PRISON.', 'Rael|No crown. No prison.', 'Lucen|One person cannot hold this.', 'Rael|Then it is a good thing I am not alone.'],
  ['Sera|Flame.', 'Nym|Frost.', 'Brann|Earth.', 'Torren|Nature.', 'Mira|Light.', 'Vex|Shadow.', 'Maelin|Spirit.', 'Kes|Wind.', 'Oren|Arcane.', 'Lucen|Void.', 'Rael|Storm. Not a king. An oath.'], { final: true, checkpointBoss: true }),
];
CAMPAIGN.forEach((m, i) => { m.index = i; m.kind = 'story'; m.level = 1 + Math.floor(i * 0.8); m.reward = 350 + i * 65; m.next = CAMPAIGN[i + 1]?.id ?? null; });

const companion = (id, hero, part, title, unlockAt, region, stages, brief, intro, outro) =>
  M(id, title, region, ['bastion', 'temple', 'sanctuary', 'ruins', 'palace'][region], part === 1 ? 'crossroads' : 'cloister', stages,
    brief, intro, outro, { kind: 'companion', hero, part, unlockAt, level: Math.max(3, Math.floor(unlockAt * 0.8)), reward: 700 + unlockAt * 35 });
export const COMPANION_QUESTS = [
  companion('rael1', 'rael', 1, 'The Letter She Never Sent', 4, 0, ['collect|A House in the Rain', 'fight|The Searchers', 'relay|His Mother’s Lock', 'defend|The Last Letter'],
    'Return to Rael’s childhood home. His mother left something the Imperial searchers never found.',
    ['Rael|I remember the door being taller.', 'Brann|You were smaller. Grief does that to a room.'], ['Rael|She knew what was inside me. She was not afraid of it.', 'Brann|She was afraid of what people would ask you to become.']),
  companion('rael2', 'rael', 2, 'A Soldier, Not a Crown', 29, 0, ['rescue|The Ones Who Stayed', 'escort|The Old Patrol Route', 'defend|A City Without Its Walls', 'oath|A Promise Kept'],
    'Rael returns to the people he could not save during the invasion. Leadership begins with listening.',
    ['Rael|They think I can fix everything.', 'Brann|Tell them the truth. Then get to work.'], ['Rael|I cannot promise you the sky will hold.', 'Survivor|Then promise us you will not stop trying.']),
  companion('sera1', 'sera', 1, 'Ashes Have Names', 12, 1, ['collect|The Names in the Furnace', 'rescue|The Unregistered', 'fight|The Commandant’s Escort', 'oath|A Place to Remember'],
    'The prison registers contain the names of Sera’s family. Find the missing pages before they vanish into the furnaces.',
    ['Sera|I remember their faces. I am starting to forget their voices.', 'Maelin|Then tell me about them.'], ['Sera|There. Their names. Not numbers.', 'Rael|Not forgotten.']),
  companion('sera2', 'sera', 2, 'What Forgiveness Is Not', 32, 1, ['fight|The Returning Legion', 'rescue|The Commandant’s Child', 'defend|The Bridge Between Enemies', 'oath|An Unfinished Reckoning'],
    'Sera and Lucen return to a place both remember differently. A surviving family needs help from the man who destroyed theirs.',
    ['Sera|This does not absolve you.', 'Lucen|I did not come here to be absolved.'], ['Sera|I can fight beside you. That is what I have today.', 'Lucen|Then that is enough for today.']),
  companion('brann1', 'brann', 1, 'The Weight of a Shield', 6, 0, ['collect|The Lost Company', 'fight|The Shardborn Patrol', 'rescue|The Last Standard Bearer', 'escort|Bring the Banner Home'],
    'Brann’s old company never reached the evacuation ships. Follow their last patrol route through occupied Stormreach.',
    ['Brann|I gave the order to hold.', 'Rael|You also gave the order to leave.', 'Brann|Some orders are harder to hear.'], ['Standard Bearer|We held because there were people behind us, Captain.', 'Brann|I know. I know.']),
  companion('brann2', 'brann', 2, 'The Wall That Walked Away', 26, 3, ['rescue|A Village Without Walls', 'defend|The First Breach', 'escort|The Children’s Crossing', 'fight|The Last Pursuers'],
    'A village asks Brann to hold a hopeless position. This time, saving it may mean abandoning the wall.',
    ['Brann|I have spent my life teaching people to stand their ground.', 'Torren|Sometimes the ground is the thing trying to kill them.'], ['Brann|Fall back. All of you. That is an order.', 'Rael|A good one.']),
  companion('nym1', 'nym', 1, 'The Future That Blinked', 18, 2, ['relay|The First Mirror', 'rescue|A Future Interrupted', 'fight|The Oracle’s Echoes', 'collect|A Page Without Words'],
    'Nym sees the same stranger die in every vision. Find a way to change one small future.',
    ['Nym|Every path ends here.', 'Kes|Then we make a very inconvenient new path.'], ['Nym|They lived.', 'Kes|Your visions need to account for worse decision-making.']),
  companion('nym2', 'nym', 2, 'One More Morning', 24, 2, ['collect|A Daughter’s Garden', 'relay|The Unfinished Lesson', 'defend|The Little Observatory', 'oath|Let the Future Go'],
    'Revisit the places Saint Avel left for Nym. There are memories that do not need to become prophecies.',
    ['Nym|I do not want to see what happens next.', 'Maelin|Then for a little while, do not look.'], ['Nym|Tomorrow can be a surprise.', 'Rael|I would like that.']),
  companion('vex1', 'vex', 1, 'The Unsent Report', 14, 1, ['sabotage|The Spy Network', 'collect|Three Dead Drops', 'rescue|A Name He Omitted', 'fight|The Handler'],
    'Vex left one name out of a report. The Empire has noticed the omission.',
    ['Vex|I was good at this. That is the part I cannot make sound better.', 'Kes|Then do not make it sound better. Make it different.'], ['Vex|The report said no survivors.', 'Survivor|It was wrong.']),
  companion('vex2', 'vex', 2, 'A Debt Without a Number', 30, 3, ['rescue|The Witnesses', 'escort|Through the Hunting Ground', 'sabotage|The Last Dead Drop', 'oath|No More Reports'],
    'Vex’s former victims are being hunted as witnesses. Help him bring them somewhere his name is not a threat.',
    ['Vex|They do not want my help.', 'Mira|Then make sure they survive long enough to refuse it.'], ['Vex|I burned the last cipher.', 'Brann|Good. We will find you honest work. It will be worse.']),
  companion('mira1', 'mira', 1, 'A Light That Casts a Shadow', 20, 2, ['collect|The Order’s Sentences', 'fight|The Penitent Knights', 'rescue|The Forbidden Healer', 'defend|The Door of Mercy'],
    'Mira discovers that her order condemned healers for using Spirit magic. One sentence has not yet been carried out.',
    ['Mira|I swore those words.', 'Maelin|You can choose what you do after them.'], ['Mira|My oath was to protect life.', 'Maelin|That sounds like an oath worth keeping.']),
  companion('mira2', 'mira', 2, 'The Sun Does Not Choose', 33, 4, ['rescue|The Imperial Infirmary', 'defend|The Wounded Line', 'relay|A Sanctuary Without a Banner', 'oath|The Merciful Eclipse'],
    'Mira and Maelin build a sanctuary for wounded people on both sides of the war.',
    ['Mira|No one asks which banner they fought under.', 'Maelin|And no one asks which magic closes the wound.'], ['Mira|Will you stand with me?', 'Maelin|I thought you would never ask.']),
  companion('torren1', 'torren', 1, 'What the Roots Remember', 26, 3, ['collect|The Harvesters’ Graves', 'fight|The Machines That Remain', 'relay|The Elder Grove', 'rescue|The Last Seedkeepers'],
    'Torren’s people buried their history inside living roots. Imperial machines are tearing it apart.',
    ['Torren|They cut down the trees that held our names.', 'Nym|Then teach me how to read what is left.'], ['Torren|You listened.', 'Nym|You had something worth hearing.']),
  companion('torren2', 'torren', 2, 'A Place for New Roots', 32, 3, ['rescue|The Human Settlement', 'defend|The Seedkeepers’ Crossing', 'relay|The First Shared Grove', 'oath|The Wild Hunt'],
    'Refugees have reached the forest. Torren must decide whether its future can make room for the people who once destroyed it.',
    ['Torren|The forest will never forget.', 'Rael|It does not have to. Neither do you.'], ['Torren|Plant them here. Carefully.', 'Refugee|What will they grow into?', 'Torren|Something we have not seen before.']),
  companion('kes1', 'kes', 1, 'A Map of Missing People', 12, 1, ['collect|The Broken Flight Paths', 'rescue|The First Survivor', 'sabotage|The Reavers’ Roost', 'escort|The Crew Comes Home'],
    'Kes has been marking missing ships on a private chart. One of the marks has started sending a signal.',
    ['Kes|I do not usually go back for things.', 'Sera|People are not things.', 'Kes|Yes. I am working on that distinction.'], ['Crewmate|You came back.', 'Kes|I had a map. It would have been wasteful not to.']),
  companion('kes2', 'kes', 2, 'The Long Way Home', 29, 3, ['relay|The Old Wind Markers', 'escort|A Flightless Caravan', 'defend|The Narrow Crossing', 'oath|A Map with a Future'],
    'The last of Kes’s crew have lost their ships. Find a road through the sky that does not require wings.',
    ['Kes|This will take longer than flying.', 'Brann|Most worthwhile things do.'], ['Kes|I put the Warden on my map.', 'Rael|What did you call it?', 'Kes|Home. Do not make a speech about it.']),
  companion('oren1', 'oren', 1, 'The Wrong Equation', 15, 1, ['collect|The Engine’s Original Plans', 'sabotage|The Siphon Prototypes', 'fight|The Foundry Custodians', 'defend|A Machine for Living'],
    'An early version of Oren’s research was used to build the life engines. Destroy the prototypes and save what the work was meant to be.',
    ['Oren|I designed this to keep hospital furnaces running.', 'Sera|Then let us remind it.'], ['Oren|The arithmetic was sound. The question was wrong.', 'Nym|Ask a better one.']),
  companion('oren2', 'oren', 2, 'An Engine with No Throne', 35, 4, ['relay|Eleven Independent Circuits', 'defend|A Dangerous First Test', 'sabotage|The Imperial Override', 'oath|The Unseen Engine'],
    'Oren and Vex attempt to build a network no emperor can control from a single throne.',
    ['Vex|I know how every Imperial override works.', 'Oren|Excellent. Help me make all of them useless.'], ['Oren|No master switch. No throne.', 'Vex|A remarkably inconvenient design for a tyrant.']),
  companion('maelin1', 'maelin', 1, 'The Names We Carry', 22, 2, ['collect|The Buried Memorials', 'fight|The Hollow Choir', 'rescue|A Voice Not Yet Gone', 'oath|The Last Name'],
    'A frightened voice is hiding among the dead. Maelin believes it belongs to someone still alive.',
    ['Maelin|People think I hear only endings.', 'Mira|What do you hear now?', 'Maelin|Someone asking for help.'], ['Survivor|I heard you say my name.', 'Maelin|I did not want you to forget it.']),
  companion('maelin2', 'maelin', 2, 'A Choir for Tomorrow', 34, 4, ['collect|The Unfinished Letters', 'defend|The Courtyard of Remembrance', 'rescue|The Last Messenger', 'oath|A Song without a Grave'],
    'The dead of the capital ask Maelin to carry messages to the living. For once, the choir is not asking to fight.',
    ['Maelin|They want someone to remember a birthday. A recipe. A terrible joke.', 'Mira|Then we had better find some paper.'], ['Maelin|The last voice said thank you.', 'Mira|So do I.']),
  companion('lucen1', 'lucen', 1, 'The Orders He Gave', 32, 1, ['collect|The Command Ledgers', 'rescue|The Prisoners He Missed', 'fight|The Officers Who Remain', 'oath|The Truth, Without Excuses'],
    'Lucen returns to the places his orders wounded. There will be no convenient absolution here.',
    ['Lucen|I thought knowing why would make it easier to face.', 'Sera|It does not. Keep walking.'], ['Lucen|I gave the orders. That is the truth.', 'Sera|Good. Start there.']),
  companion('lucen2', 'lucen', 2, 'Seventeen Years', 36, 0, ['collect|Two Brothers’ Training Ground', 'relay|The Lesson They Remember', 'defend|The Storm That Remained', 'oath|Twin Tempest'],
    'Rael and Lucen return to the training court they shared before Crownfall. Neither is the boy the other remembers.',
    ['Lucen|You still leave your left side open.', 'Rael|You still talk too much before a fight.'], ['Lucen|I do not know how to be your brother anymore.', 'Rael|We can learn. We have done harder things.']),
];

export const HUNTS = [
  ['h01', 'The Bell Beneath the Storm', 0, 'colossus', 12, 'Conductive rain', 'A second jailer wakes beneath the ruined lightning towers. Its bell draws lightning to every living thing.'],
  ['h02', 'The Last Furnace', 1, 'ashking', 20, 'Rising lava', 'An abandoned furnace still burns with a king’s stolen fire. Close it before the mountain wakes again.'],
  ['h03', 'The Mirror That Remembered', 2, 'saint', 25, 'Frozen echoes', 'An echo of Saint Avel is trapped in a fractured mirror. Release it without breaking the city’s remaining wards.'],
  ['h04', 'A Mouth without a Name', 3, 'rootless', 31, 'Corrupting roots', 'One root escaped the fall of the Rootless God. It has found something new to feed on.'],
  ['h05', 'The Crownless Procession', 4, 'warden', 36, 'Unbroken guards', 'The oldest guardians of the palace are marching toward an empty throne. End their final order.'],
  ['h06', 'A Storm That Hunts', 0, 'lucen', 40, 'Moving stormwalls', 'A Crownfall echo has borrowed Lucen’s fighting style and none of his mercy.'],
  ['h07', 'Nine Days of Ash', 1, 'warengine', 40, 'Relentless reinforcements', 'A siege engine has been fighting a war that ended nine days ago. Its ammunition is the mountain itself.'],
  ['h08', 'The Winter Behind Winter', 2, 'saint', 40, 'Time fractures', 'Beyond the final mirror is a winter that never belonged to Aetherra. Seal its frozen door.'],
  ['h09', 'The World Beast’s Dream', 3, 'worldbeast', 40, 'Ancient rage', 'The World Beast dreams of the years it spent holding back the darkness. Walk beside it through the dream.'],
  ['h10', 'The Oathbreaker’s Crown', 4, 'malthren', 40, 'Five-force confluence', 'The Crown remembers the man who tried to own it. Face the memory without becoming it.'],
].map(([id, title, region, boss, unlockAt, modifier, brief], i) => M(id, title, region, 'arena', 'citadel', [
  'collect|Follow the Crown’s Echo', 'fight|The Echo’s Guardians', 'relay|Break the Three Seals', `boss|${title}|${boss}`, 'oath|A Memory Laid to Rest',
], brief, [`Nym|This is not the past. It is what the Crown remembers of it.`, `Rael|Then we give it something new to remember.`],
['Maelin|It is quieter now.', 'Rael|Let it rest.'], { kind: 'hunt', unlockAt, modifier, level: 15 + i * 3, reward: 1800 + i * 140, crownfall: unlockAt === 40 }));

export const TRIAL_MODIFIERS = [
  { id: 'surge', name: 'Conductive Rain', description: 'All combatants are wet. Lightning spreads farther.', effect: 'wet' },
  { id: 'embers', name: 'Falling Embers', description: 'Volcanic impacts force constant movement.', effect: 'lava' },
  { id: 'glass', name: 'Glass Resolve', description: 'Both sides deal 35% more damage.', effect: 'glass' },
  { id: 'winter', name: 'The Long Winter', description: 'Frost storms periodically slow the battlefield.', effect: 'frost' },
  { id: 'hollow', name: 'The Hollow Choir', description: 'Priests return fallen enemies to the fight.', effect: 'priests' },
  { id: 'walls', name: 'Prison of Thunder', description: 'Moving lightning walls divide the arena.', effect: 'walls' },
  { id: 'hunger', name: 'Crown’s Hunger', description: 'Focus regeneration is halved. Attacks restore more.', effect: 'focus' },
  { id: 'confluence', name: 'Elemental Confluence', description: 'Elemental reactions deal double damage.', effect: 'reactions' },
];
export function trialMission(tier = 1, eleven = false) {
  const region = (tier - 1) % 5, mod = TRIAL_MODIFIERS[(tier - 1) % TRIAL_MODIFIERS.length];
  return M(eleven ? 'eleven' : `trial-${tier}`, eleven ? 'The Eleven' : `Storm Trial ${String(tier).padStart(2, '0')}`, region, 'arena', 'arena',
    [eleven ? 'eleven|The Eight You Did Not Choose' : 'trial|The Storm’s Invitation'],
    eleven ? 'Choose three anchors. Face the other eight as Crown echoes, then withstand the brothers’ Twin Tempest.' : mod.description,
    ['Rael|The storm favors the bold.'], ['Brann|Still standing. That will do.'],
    { kind: 'trial', tier, eleven, modifier: mod, level: 8 + tier * 2, reward: 700 + tier * 160 });
}
export const MISSIONS = [...CAMPAIGN, ...COMPANION_QUESTS, ...HUNTS];
export const MISSION_BY_ID = Object.fromEntries(MISSIONS.map(m => [m.id, m]));
export function getMission(id) { return MISSION_BY_ID[id] ?? (id === 'eleven' ? trialMission(20, true) : /^trial-\d+$/.test(id) ? trialMission(Math.max(1, Number(id.slice(6)))) : null); }
export function availableMissions(save) {
  const cleared = CAMPAIGN.filter(m => save.completed.includes(m.id)).length;
  return MISSIONS.filter(m => m.kind === 'story' ? m.index <= cleared : cleared >= m.unlockAt && (!m.hero || save.unlocked.includes(m.hero)) && (m.part !== 2 || save.completed.includes(`${m.hero}1`)));
}
export function regionProgress(save, region) { const ms = CAMPAIGN.filter(m => m.region === region); return { done: ms.filter(m => save.completed.includes(m.id)).length, total: ms.length }; }
export const CONTENT_COUNTS = Object.freeze({ story: CAMPAIGN.length, companion: COMPANION_QUESTS.length, hunts: HUNTS.length, heroes: HEROES.length, regions: REGIONS.length, stages: MISSIONS.reduce((n, m) => n + m.stages.length, 0) });
