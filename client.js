var option = 0

function sendBallot (cb){
  $.post( window.location.pathname, $( "#ballot" ).serialize(),()=>{
    window.location.pathname='/'
  })
}

//$(".option-box-input").change(sendBallot)

$( "body" ).keypress(function( event ) {
  var code = event.charCode
  if( 97 <= code && code <= 105 ) {
    option = code - 97
    $(".ballot .option.selected").removeClass("selected")
    $("#option-"+option).addClass("selected")
  }
  if( 49 <= code && code <= 57 ) {
    box = code - 49
    $("#option-"+option+" input").prop('checked', false)
    $("#option-box-"+option+"-"+box).prop('checked', true)
    //sendBallot()
  }
  if( event.key == "Enter" ) {
    sendBallot()
  }
})
