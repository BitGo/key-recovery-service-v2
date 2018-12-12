#!/bin/bash

# 12-6-2018 Version

set -e

usage() {
    echo "Usage:"
    echo "    git-merge -h                Display this help message."
    echo "    -b <branch>                 Name of the branch to merge."
    echo "    -i <branch>                 Specify the name of the branch to merge into."
    echo "    -r                          Enable rebasing."
    echo "    -s                          Enable squashing."
    echo ""
    echo "Sample:"
    echo "    git merge -b my-branch -i rel/magento -rs"
    exit 0
}


BRANCH_TO_MERGE_INTO=master
YUBIKEY_MSG=$'\e[1;32m'"YubiKey 🔐"$'\e[0m'
COL_ERR=$'\e[1;31m'
COL_INF=$'\e[1;34m'
COL_RESET=$'\e[0m'

print_info() {
    echo $COL_INF$1$COL_RESET
}

print_error() {
    echo $COL_ERR$1$COL_RESET
}

while getopts ":b:i::rshf" opt; do
  case ${opt} in
    b )
        BRANCH_TO_MERGE=$OPTARG ;;
    i )
        BRANCH_TO_MERGE_INTO=$OPTARG ;;
    r )
        REBASE=1
        echo "Rebase option enabled" ;;
    s )
        SQUASH=1
        echo "Squash option enabled" ;;
    f )
        FORCE=1
        echo ""
        echo "====================================================================================="
        echo "You have enabled god mode, we hope that you know what you are doing."
        echo "If tests gets broken in master or breaks the release with lint issues... no bueno."
        echo "====================================================================================="
        echo "" ;;
    h )
        usage ;;
    \? )
      print_error "Invalid Option: -$OPTARG" 1>&2
      exit 1 ;;
  esac
done

shift $((OPTIND -1))

if [ -z "$BRANCH_TO_MERGE" ]; then
    print_error "Missing parameter branch to merge"
    exit -1
fi

print_info "Merging \"$BRANCH_TO_MERGE\" into \"$BRANCH_TO_MERGE_INTO\""

abort () {
  git rebase --abort
  print_error "The auto-merge script failed when attempting to rebase. Please ask\nthe author of this branch to rebase their change and resolve conflicts."
  exit
}

# Update master
echo $YUBIKEY_MSG
git fetch
git checkout $BRANCH_TO_MERGE_INTO
echo $YUBIKEY_MSG
git pull

# Get shorthand commit hash of tip of master
HEAD=$(git log -1 --pretty=format:"%h")

# Checkout the new branch locally
git checkout -B $BRANCH_TO_MERGE origin/$BRANCH_TO_MERGE

# create an archive branch starting with zzz to maintain commit history
git checkout -B zzz/$BRANCH_TO_MERGE

# Go back to original branch
git checkout $BRANCH_TO_MERGE

if [[ $SQUASH == 1 ]]; then
    print_info "Squashing commits..."
    # Get first commit on branch - will use message after squashing
    BRANCH_COMMIT=$(git cherry $BRANCH_TO_MERGE_INTO | head -1 | cut -f 2 -d ' ')
    # last commit before this branch
    PREV_COMMIT=$(git show $BRANCH_COMMIT^1 | head -1 | cut -f 2 -d ' ')

    # Squash all commits in the feature branch
    git reset --soft $PREV_COMMIT

    # only commit if we did a squash (otherwise the script will exit)
    if [[ $(git status | tail -1) != "nothing to commit, working tree clean" ]]; then
        echo $YUBIKEY_MSG
        git commit --verbose --reedit-message=$BRANCH_COMMIT
    else
        print_info "Nothing to squash"
    fi
fi

if [[ $REBASE == 1 ]]; then
    print_info "Rebasing with $BRANCH_TO_MERGE_INTO"
    git rebase $BRANCH_TO_MERGE_INTO || abort
fi

# Check that the branch only adds one commit to the tip of master
BRANCH_SECOND_COMMIT=$(git log -n 1 --skip 1 --pretty=format:"%h" )

# only accept squashed and rebased branches (previous to last commit has to match master)
if [[ "$HEAD" == "$BRANCH_SECOND_COMMIT" ]]; then
    print_info "Branch is OK, pushing..."

    # push the backup branch
    print_info "Pushing backup branch to zzz/$BRANCH_TO_MERGE"
    git checkout zzz/$BRANCH_TO_MERGE
    echo $YUBIKEY_MSG
    git push origin zzz/$BRANCH_TO_MERGE
    git checkout $BRANCH_TO_MERGE

    # Push squashed feature branch back up to remote (so GitHub can recognize merge)
    print_info "Pushing squash commit..."
    echo $YUBIKEY_MSG
    git push --force-with-lease

    # Perform merge
    print_info "Merging..."
    git checkout $BRANCH_TO_MERGE_INTO
    echo $YUBIKEY_MSG
    git merge $BRANCH_TO_MERGE --no-ff

    # Push merged base branch
    print_info "Push the merge..."
    echo $YUBIKEY_MSG
    git push

    # Delete feature branch
    print_info "Deleting branch..."
    echo $YUBIKEY_MSG
    git push origin --delete $BRANCH_TO_MERGE
    git branch -d $BRANCH_TO_MERGE
    git branch -D zzz/$BRANCH_TO_MERGE
else
    print_error "Holy Moly, $BRANCH_TO_MERGE not ready to be pushed, it needs to be squashed or rebased"
fi
