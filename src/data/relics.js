/** Relics change decisions, rather than replacing the cast's signature weapons. */
export const RELICS = [
  { id:'grounding', name:'Grounding Sigil', glyph:'ϟ', at:2, text:'Absorbing a storm strike restores 12% health as well as Focus.', effects:{ absorbHeal:.12 } },
  { id:'bell', name:'The Bellmaker’s Heart', glyph:'♧', at:4, text:'Perfect parries heal nearby allies for 3% of their maximum health.', effects:{ parryHeal:.03 } },
  { id:'rain', name:'A Memory of Rain', glyph:'◌', at:6, text:'Elemental reactions grant 8 additional Judgment. Reaction damage increases by 12%.', effects:{ reactionCharge:8, reactionDamage:.12 } },
  { id:'ember', name:'An Ember Unspent', glyph:'♨', at:10, text:'The first fatal blow in each encounter leaves you standing with 20% health.', effects:{ lastStand:1 } },
  { id:'wing', name:'The Windrider’s Compass', glyph:'≋', at:12, text:'Evading costs 25% less Stamina. Movement speed increases by 7%.', effects:{ dodgeCost:-.25, speed:.07 } },
  { id:'engine', name:'Vox’s First Equation', glyph:'⌘', at:14, text:'Constructs last 40% longer and fire 15% faster.', effects:{ constructDuration:.4, constructSpeed:.15 } },
  { id:'winter', name:'The Unfinished Hour', glyph:'❄', at:18, text:'Frozen enemies remain frozen 1 second longer. Shatter deals 25% more damage.', effects:{ freezeTime:1, shatter:.25 } },
  { id:'mercy', name:'The Weight of Mercy', glyph:'☀', at:20, text:'Healing is 20% stronger. Using a remedy grants 5 seconds of protection.', effects:{ healing:.2, remedyShield:5 } },
  { id:'veil', name:'The Veilwalker’s Coin', glyph:'☽', at:22, text:'Striking from behind deals 25% more damage and restores 6 Focus.', effects:{ backstab:.25, backFocus:6 } },
  { id:'seed', name:'The First Shared Seed', glyph:'❧', at:26, text:'Allies below 40% health regenerate slowly while they stay near you.', effects:{ lowRegen:.012 } },
  { id:'root', name:'A Root That Remembered', glyph:'◆', at:29, text:'Heavy attacks deal 30% more stagger. Landing a launch restores 10 Stamina.', effects:{ stagger:.3, launchStamina:10 } },
  { id:'brothers', name:'Seventeen Years', glyph:'✧', at:32, text:'Switching characters grants 2 seconds of invulnerability; 12 second cooldown.', effects:{ switchGuard:2 } },
  { id:'census', name:'A Name, Not a Number', glyph:'◇', at:34, text:'Rescued civilians grant a permanent mission-wide 4% damage bonus, up to 24%.', effects:{ rescuePower:.04 } },
  { id:'throne', name:'A Throne for No One', glyph:'◈', at:36, text:'Bond attacks require 20% less Unity and restore 25 Focus to the party.', effects:{ bondCost:-.2, bondFocus:25 } },
  { id:'oath', name:'The Eleventh Fragment', glyph:'♜', at:40, text:'Ultimates cost 15% less Judgment. Every ultimate strengthens the other two heroes for 8 seconds.', effects:{ ultimateCost:-.15, oathEmpower:.2 } },
  { id:'warden', name:'The Crownless Seal', glyph:'⚜', quest:'h05', text:'Blocking costs no Stamina. Perfect parries strike back with Void.', effects:{ freeBlock:1, parryVoid:1 } },
  { id:'choir', name:'A Choir for Tomorrow', glyph:'♬', quest:'maelin2', text:'Defeated enemies restore 2% health to the lowest-health party member.', effects:{ deathHeal:.02 } },
  { id:'eleven', name:'The Shared Crown', glyph:'♔', quest:'eleven', text:'All elemental reactions gain 35% power. Gold-and-storm oath armor becomes available.', effects:{ reactionDamage:.35, oathArmor:1 } },
];
export const RELIC_BY_ID = Object.fromEntries(RELICS.map(r => [r.id, r]));
