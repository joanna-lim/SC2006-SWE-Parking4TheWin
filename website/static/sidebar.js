export function updateIHaveParkedButtonUI(interestedCarpark) {
    if (interestedCarpark) {
      $('#i-have-parked-btn').show();
    } else {
      $('#i-have-parked-btn').hide();
    }
  }