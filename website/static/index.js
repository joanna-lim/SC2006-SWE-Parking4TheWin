function deleteReward(rewardId) {
    fetch('/delete-reward', {
        method:'POST',
        body: JSON.stringify({ rewardId: rewardId })
    }).then((_res)=>{
        window.location.href="/posted-rewards";
    });
}