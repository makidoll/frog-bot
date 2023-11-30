#!/bin/bash

# script for syncing attachments from server
# append with wsl on windows

rsync -aP --delete --exclude update-all.sh blahaj:~/frog-bot/attachments/makis-home/. .
