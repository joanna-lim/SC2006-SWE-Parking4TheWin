function deleteReward(rewardId) {
    if (confirm("Are you sure you want to delete this reward?")) {
    fetch('/rewards', {
        method:'DELETE',
        body: JSON.stringify({ rewardId: rewardId })
    }).then((_res)=>{
        window.location.href="/rewards";
    });
}
}

function deleteVehicle(vehicleId) {
    if (confirm("Are you sure you want to delete this vehicle?")) {
        fetch('/vehicles', {
            method: 'DELETE',
            body: JSON.stringify({ vehicleId: vehicleId })
        }).then((_res) => {
            window.location.href = "/coe/registered_vehicles";
        });
    }
}

function changePoints(points_change){
    fetch('/points', {
        method: 'PUT',
        body: JSON.stringify({points_change : points_change})
    }).then((_res) => {
        window.location.href = "/points";
    });
}