from py3votecore.schulze_method import SchulzeMethod
from py3votecore.schulze_pr import SchulzePR
from py3votecore.condorcet import CondorcetHelper
from py3votecore.tie_breaker import TieBreaker

import sys, json
input = json.load(sys.stdin)
ballots = input['ballots']
config = input['config']

if "tie_breaker" in config:
    tie_breaker = config['tie_breaker']
    result_schulze_pr = SchulzePR(ballots, winner_threshold=config['winner_threshold'], tie_breaker=tie_breaker, ballot_notation = CondorcetHelper.BALLOT_NOTATION_GROUPING).as_dict()
else:
    tie_breaker = []
    result_schulze_pr = SchulzePR(ballots, winner_threshold=config['winner_threshold'], ballot_notation = CondorcetHelper.BALLOT_NOTATION_GROUPING).as_dict()
print(result_schulze_pr)

result_schulze_method = SchulzeMethod(ballots).as_dict()
print(result_schulze_method)

print()

winners = []
tie = False
for round in result_schulze_pr["rounds"]:
    if "tied_winners" in round and not round['winner'] in tie_breaker:
        print (round)
        tie = True
        tie_between = []
        for t in round['tied_winners']:
            tie_between.append(t)
        break
    else:
        winners.append(round['winner'])

strong_pairs=[]
for strong_pair,strength in result_schulze_method["strong_pairs"].items():
    strong_pairs.append({
        "from":strong_pair[0],
        "to":strong_pair[1],
        "strength":strength
    })
pairs=[]
for pair,strength in result_schulze_method["pairs"].items():
    pairs.append({
        "from":pair[0],
        "to":pair[1],
        "strength":strength
    })

output = {
    "winners": winners,
    "strong_pairs": strong_pairs,
    "pairs": pairs
}
if tie:
    output["tie_between"] = tie_between,


json.dump(output, sys.stdout, indent=2, sort_keys=True)
