class UIComponent {
    constructor(id) {
      this.id = id;
      this.component = $(`#${id}`);
    }
  }
  
  class GenericButton extends UIComponent {
    constructor(id, beforeCall, duringCall, afterCall) {
      super(id);
      this.beforeCall = beforeCall;
      this.duringCall = duringCall;
      this.afterCall = afterCall;
    
      this.component.click(async (event) => { 
        event.preventDefault();
  
        this.component.prop("disabled", true);
        this.beforeCall();
  
        try {
          await this.duringCall();
        } catch (error) {
          console.error(error);
          return;
        }
  
        this.afterCall();
        this.component.prop("disabled", false);
      });
    }
  }
  
  export class SpinnerButton extends GenericButton {
    constructor(id, duringCall) {
      super(id, () => {
        // Show buffering icon
  
        this.component.children(".enabled-label").hide();
        this.component.children(".disabled-label").show();
        this.component.children(".spinner-border").show();
      },
        duringCall,
        () => {
          // Remove buffering icon
          this.component.children(".spinner-border").hide();
          this.component.children(".disabled-label").hide();
          this.component.children(".enabled-label").show();
          
        }
      )
    }
  }