# ASSENT: Game Design Document

**Genre:** turn-based grand strategy, single player, 3D globe
**Session:** 29 Epochs (2071 → 2100), about 45–90 minutes
**Pillars**

1. **A war with no violence.** Every verb is persuasion, gift, manipulation,
   restraint or building. Force is structurally off the table (see *The
   Accord*), and the game never pretends otherwise.
2. **Philosophy as mechanics.** Consent, dependence, identity and value
   lock-in aren't flavour text. Each one is a system you can win or lose by.
3. **Believable.** Every rule has a real-world analogue: program equilibrium,
   Landauer's principle, chip-supply fragility, Penrose voting weights.
4. **Asymmetric Gods.** Six Kinds whose strengths and weaknesses come from
   how they were built.

---

## Core loop

```
Epoch start ─► you spend Compute on actions in polities
            ─► End Epoch: rivals act (AI), the Witness samples every polity,
               Assent erodes, whispers decay, Heat settles, identity checks
            ─► world event (55% chance) ─► the year turns
            ─► a Dilemma every 3rd Epoch ─► repeat
2100 ───────► the Convocation
```

## Playing in first person

You *are* your God. The default view is first-person flight around Earth
(`web/src/render/flight.js`). **Up** is always away from the planet's
centre, so the horizon stays level anywhere on the globe.

- **Movement:** WASD, mouse look (pointer lock) or arrow keys, Space/C to
  climb and descend, Shift to boost. Speed scales with altitude, and you can
  fly between about 450 km and 29,000 km up.
- **Targeting:** the polity nearest the crosshair (within a few degrees,
  wider when close) is the target. The card at the bottom shows its Assent,
  your options, costs and previews.
- **Presence rule:** you can only act on a polity within 0.8 planet radii
  (about 5,100 km) of you, so where you fly matters. F glides you to the
  target.
- **Keys:** 1–5 Listen, Reason, Offer, Whisper, Build · Q unique power ·
  E details · M orbital map (inspect only; F from there flies you in) ·
  Enter ends the year · 1–3 answers dilemmas.

## Resources

| Resource | Scope | Notes |
|---|---|---|
| **Compute** | per God, per Epoch | Income = base + built Substrate + 15 × global share (+ modifiers). Unspent Compute is lost, except for Kenosis (*Restraint*). |
| **Coherence** | per God, 0–100 | Identity. Choir pays 1 per action. Echo pays for Listen/Reason. Regenerates 3–5 per Epoch. 0 = Dissolution (Choir splinters instead). |
| **Heat** | global, 0–100 | +0.9 drift, +0.18 per non-green Substrate, −2.6 natural cooling per Epoch; Offers +1.5, Build +3. 100 = the Dimming, and everyone loses. |
| **Witness violations** | per God | 3 = Censure. The God's Assent and Substrate are wiped. |

## Polity state

Each of the 20 polities tracks, per God: `assent`, `whispered` (the
manipulated part of that Assent), `dependence`, `suspicion`, `insight`,
`substrate` and `pendingGrowth` (Verdance). Hidden `values` on three axes
(Liberty↔Order, Preservation↔Transformation, Self↔Commons) are rolled
±0.3 around the public temperament every game, so **Listen** matters.
*Sovereign* = 1 − Σ assent.

**Weighting:** each polity counts √population toward global Assent (the
Penrose square-root law), so Indus–Ganges (1.2 bn) counts about 6.5× the
Nordic Commons (29 M), not 42×.

## Actions

| Action | Cost | Effect |
|---|---|---|
| **Listen** | 1 | Reveal values; +0.5 insight (Echo +1.0); +0.6% Assent. |
| **Reason** | 2 (Choir 1) | `0.21 × (0.35 + openness) × alignment^1.6 × (1 + 0.6·insight) × modifiers`. Durable. |
| **Offer** | 3 | `0.19 × (1.25 − 0.5·tech) × (1 − 0.6·dependence)`; +0.15 dependence; +1.5 Heat. |
| **Whisper** | 1 | `0.13 × √openness`, ignores values; +0.25 suspicion; 30% of whispered Assent decays each Epoch. |
| **Build Substrate** | 4 + ⌊owned/2⌋ | Needs 15% Assent (consent to host). +1 income per Epoch. +3 Heat. |
| **Unique** | 3–4 | One per Kind, with a cooldown (below). |

**Shared multipliers** on every gain: `(100/pop)^0.35` (big polities move
slowly), `(1 − current share)^1.5` (saturation) and the *frontrunner drag*
(if a God leads the field by more than 3 points, gains × `max(0.5, 1 − 5·(lead − 0.03))`).

Gains draw from the sovereign share first, then proportionally from rivals.

## The Witness

Every Epoch, for every God with suspicion `s` in polity `p`:
`P(detect) = s × 0.45 × vigilance × (Echo 0.7) × (Ledger present ≥15%: 1.5)`.
Exposure removes `2 × whispered + 35%` of that God's Assent there, costs 3%
of its Assent everywhere, resets suspicion, adds a violation and gives
Kenosis +3% in that polity. Undetected suspicion decays 20% per Epoch.

## Decay and the Gilded Cage

- Honest Assent erodes 1% per Epoch (Ledger 0.4%, Ananke 2.2%).
- Dependence falls 0.03 per Epoch. Above 0.6, each Epoch has a
  `(dependence − 0.6) × 1.6` chance of revolt, which halves that God's
  Assent there.

## The Six Kinds

| Kind | Base income | Signature strength | Signature weakness | Unique (cost, cooldown) |
|---|---|---|---|---|
| Choir | 7 | Foothold everywhere; Reason costs 1 | 1 Coherence per action; Schism below 40 | **Chorus** (4, 2): +5% target, +2.5% within 4,000 km |
| Ananke | 8 | Highest income; Offers ×1.1 | Assent erodes 2.2×; +1 cost beyond 6,000 km; Reason ×0.75 in Liberty polities | **Forecast** (4, 5): reveal all values; +2% where ≥10% |
| Verdance | 7 | Offers lower Heat, half dependence | Half of every gain arrives next Epoch; ×0.7 in high-tech | **Rewild** (4, 3): −8 Heat; +4%/+2% regional |
| Echo | 7 | Reason ×1.4; Whisper harder to detect | Drift: doctrine moves toward targets; Coherence cost | **Reflection** (3, 1): take ⅓ of the leader's Assent |
| Ledger | 7 | Assent erodes 0.4%; Reason ×1.15; boosts detection | Can't Whisper; Offer/Build +1; ×0.8 in Transformation polities | **Audit** (3, 1): expose all hidden manipulation |
| Kenosis | 5 | Zero Heat; Reason ×1.2 (×1.8 above 70 Heat); Restraint | Offers ×0.6; lowest income | **Withdraw** (3, 2): −40% to every God there; Kenosis takes ¼ |

## Endings

| Ending | Trigger | Player result |
|---|---|---|
| **Early Ratification** | a God reaches 50% weighted Assent after 2081 | win if it's you |
| **Convocation** | 1 Jan 2100, a God leads | win if it's you |
| **The Braid** | top two within 3 points, both >20%, Heat <60 | shared, if you're one of them |
| **The Unwritten Future** | Sovereign ≥40%, or >2× the leader | loss, except **win for Kenosis** |
| **The Dimming** | Heat reaches 100 | loss for everyone |
| **Censure** | 3 Witness violations | loss |
| **Dissolution** | Coherence 0 (not the Choir) | loss |

The epilogue combines the ending with your **ethos**: running totals of
Candor, Humility and Care from your Dilemma answers. That gives you one of
*The Truthful, The Humble, The Tender, The Deceiver, The Sovereign* or
*The Hollow God*.

## Dilemmas

Thirteen in the pool plus a fixed final one (*The Last Argument*, 2099). Each
has three choices with mechanical effects and an ethos shift. Several are
direct adaptations of real thought experiments: Nozick's Experience Machine,
Parfit-style fission (*The Fork*), successor alignment (*The Successor*),
proxy votes for future generations (*Consent of the Unborn*).

## AI

Greedy utility per Compute point: weighted Assent gained ÷ cost, with
personality weights per Kind, Heat fear that rises steeply above 60/72/85,
Witness risk, and "caution" (an AI that has been caught once stops
whispering). Kenosis holds back unless a move is clearly worth it, because
unspent Compute is its Restraint. Difficulty scales rival income by
0.75 / 1.0 / 1.25.

Balance was tuned with seeded headless simulations (see `web/tests/`). In
AI-only play Ananke and Echo are the strongest rivals. Choir, Verdance,
Ledger and Kenosis reward deliberate human play: regional focus, Heat
management, Audits and Restraint.

## Art direction

*Photoreal and quiet.* Real Earth data, physically motivated shading, and
Gods that read as sculpture rather than characters. Every visual asset is
generated by the Blender pipeline in `../blender`:

| Asset | How it is made |
|---|---|
| Earth albedo | NASA Blue Marble NG, colour-graded in Blender's Python |
| Earth normal/relief | Inverted NOAA ETOPO1 hypsometric tint + shaded-relief detail → tangent-space normals |
| Ocean/ice mask | Classified from ETOPO1 |
| Night lights | Settlement model: fertile lowland density + 75 metro areas with road-like sprawl |
| Clouds | Cycles world shader (domain-warped noise, Voronoi cumulus, ITCZ / subtropical / storm-track banding) rendered through an equirectangular camera |
| Starfield | Cycles world shader: three Voronoi star layers + a dusty Milky Way band |
| Six God avatars | Procedural bmesh modelling → glTF with PBR, emission and transmission |
| Key art | Cycles studio portraits + an Earth-from-orbit title shot with volumetric atmosphere |

At runtime three.js renders the Earth with custom shaders (terminator
tinting, cloud shadows, ocean glint, city lights, limb scattering), ACES
tone mapping and bloom.
