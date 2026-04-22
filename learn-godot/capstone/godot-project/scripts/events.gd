extends Node

## Events autoload — cross-scene signal bus.
##
## Nodes emit here instead of coupling to each other. The UI listens; the duel
## controller listens; neither knows about the other. Add signals as features
## need them — keep them typed.

signal word_submitted(word: String, damage: int)
signal turn_started(side: String) ## "player" or "enemy"
signal turn_ended(side: String)
signal combatant_damaged(combatant: Node, amount: int)
signal combatant_died(combatant: Node)
signal duel_won()
signal duel_lost()
signal card_tapped(card: Node)
