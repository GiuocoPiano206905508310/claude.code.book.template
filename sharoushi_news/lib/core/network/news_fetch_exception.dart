class NewsFetchException implements Exception {
  NewsFetchException(this.message);

  final String message;

  @override
  String toString() => 'NewsFetchException: $message';
}
