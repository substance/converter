#!/bin/bash
FILES=./markdown/*.md
for f in $FILES
do
  filename=$(basename "$f")
  pandoc -f markdown -t json -o ${filename%.*}.json $f
done
