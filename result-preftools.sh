#!/bin/sh
mkdir -p tmp
wget -q -O tmp/candidates.txt http://localhost:8080/preftools/candidates.txt
wget -q -O tmp/ballots.txt http://localhost:8080/preftools/ballots.txt
lua5.1 ./preftools-v0.9/schulze -c tmp/candidates.txt -b tmp/ballots.txt -d last -q 0
