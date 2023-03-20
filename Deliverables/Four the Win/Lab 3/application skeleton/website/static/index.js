function deleteReward(rewardId) {
    if (confirm("Are you sure you want to delete this reward?")) {
    fetch('/delete-reward', {
        method:'POST',
        body: JSON.stringify({ rewardId: rewardId })
    }).then((_res)=>{
        window.location.href="/posted-rewards";
    });
}
}

function deleteVehicle(vehicleId) {
    if (confirm("Are you sure you want to delete this vehicle?")) {
        fetch('/delete-vehicle', {
            method: 'POST',
            body: JSON.stringify({ vehicleId: vehicleId })
        }).then((_res) => {
            window.location.href = "/registered-vehicles";
        });
    }
}

function addPoints(){
    fetch('/add-points', {
        method: 'POST',
    }).then((_res) => {
        window.location.href = "/claim-points";
    });
}
function deductPoints(){
    fetch('/deduct-points', {
        method: 'POST',
    }).then((_res) => {
        window.location.href = "/claim-points";
    });
}