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

function removeUserReward(rewardId) {
    fetch('/rewards/use', {
        method:'DELETE',
        body: JSON.stringify({ rewardId: rewardId })
    }).then((_res)=>{
        // Display the modal here
        $('#qr-modal').modal('show');

        // Add event listener to close button
        $('#qr-modal').on('hidden.bs.modal', function () {
            // Redirect the user to the rewards page
            window.location.href = "/rewards";
        })
    });
}



function changePoints(points_change){
    fetch('/points', {
        method: 'PUT',
        body: JSON.stringify({points_change : points_change})
    }).then((_res) => {
        window.location.href = "/points";
    });
}